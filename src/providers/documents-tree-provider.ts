/*
 * The Documentation view of the Test Wright activity bar: the learning paths shipped in the
 * extension's resources.docs folder, laid out as the G4 Engine Client lays out a project's docs.
 *
 * Like a file explorer, folders come first and files after them, each group in file-name order,
 * so numbered modules keep their order. Every node is named the way the learning paths name it
 * for readers: a folder by its README's title ("data-driven-runs" shows as "Data-Driven Runs"),
 * a file by the link text its folder's index gives it ("01-get-set-up.md" shows as "Get set up"),
 * then by its own title (see DocumentLabelService). Only Markdown files are listed, so folders
 * without Markdown (images, practice) are left out. Selecting a document opens the Markdown
 * preview from its real location, so relative links and images work.
 */
import * as vscode from 'vscode';

import { DocumentLabelService } from '../services/document-label-service';

// The view id declared in package.json.
export const DOCUMENTS_VIEW_ID = 'g4TestWrightDocuments';

// The view-title command that rebuilds the tree.
const REFRESH_COMMAND = 'TestWright.RefreshDocuments';

// The extension folder that holds the learning paths.
const DOCUMENTS_FOLDER = 'resources.docs';

// The index that names the documents of the docs root.
const ROOT_INDEX_FILE_NAME = 'test-wright-learning.md';

// The index that names the documents of a learning-path folder, and gives the folder its title.
const FOLDER_INDEX_FILE_NAME = 'readme.md';

// File extensions listed as documents.
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);

/**
 * Tree data provider of the Documentation view.
 *
 * @remarks
 * The tree is read from disk on every refresh; the folder ships with the extension, so it only
 * changes when the extension is updated or, while developing, edited.
 */
export class DocumentsTreeProvider implements vscode.TreeDataProvider<DocumentNode> {
    // Fires when the tree must be read again.
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<DocumentNode | undefined>();

    /** Tells VS Code the tree changed. */
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // The extension context (its install folder and its subscriptions).
    private readonly _context: vscode.ExtensionContext;

    /**
     * Creates the provider.
     *
     * @param context - The extension context.
     */
    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    /**
     * Returns the children of a folder, or the root items.
     *
     * @param element - The folder; undefined for the root.
     * @returns The child nodes.
     */
    public async getChildren(element?: DocumentNode): Promise<DocumentNode[]> {
        // A folder's children were read with it; the root is read from the extension's docs folder.
        if (element !== undefined) {
            return element.children ?? [];
        }

        const rootUri = vscode.Uri.joinPath(this._context.extensionUri, DOCUMENTS_FOLDER);

        return DocumentsTreeProvider.findDocuments(rootUri, true);
    }

    /**
     * Returns a node as its tree item.
     *
     * @param element - The node.
     * @returns The same node.
     */
    public getTreeItem(element: DocumentNode): vscode.TreeItem {
        return element;
    }

    /**
     * Rebuilds the tree.
     */
    public refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Creates the view and its refresh command, owned by the extension context.
     */
    public register(): void {
        const view = vscode.window.createTreeView(DOCUMENTS_VIEW_ID, { treeDataProvider: this });
        const refreshCommand = vscode.commands.registerCommand(REFRESH_COMMAND, () => this.refresh());

        this._context.subscriptions.push(view, refreshCommand, this._onDidChangeTreeData);
    }

    /**
     * Reads the Markdown documents under a folder, recursively.
     *
     * @param folderUri - The folder to read.
     * @param isRoot - Whether this is the docs root, whose index is test-wright-learning.md instead of a README.
     * @returns Folders first, then files; each group in file-name order.
     *
     * @remarks
     * Folders without Markdown are left out, and an unreadable folder or file yields no node
     * instead of failing the whole tree. The folder's index is read once, so every file of the
     * folder is named from the same links.
     */
    private static async findDocuments(folderUri: vscode.Uri, isRoot: boolean): Promise<DocumentNode[]> {
        // An unreadable folder contributes nothing.
        let entries: [string, vscode.FileType][];

        try {
            entries = await vscode.workspace.fs.readDirectory(folderUri);
        } catch {
            return [];
        }

        // Read the names the folder's index gives its documents; a folder without an index names none.
        const indexFileName = isRoot ? ROOT_INDEX_FILE_NAME : FOLDER_INDEX_FILE_NAME;
        const indexEntry = entries.find(([name, type]) => type === vscode.FileType.File && name.toLowerCase() === indexFileName);
        const indexText = indexEntry === undefined
            ? ''
            : await DocumentsTreeProvider.readText(vscode.Uri.joinPath(folderUri, indexEntry[0]));
        const linkLabels = DocumentLabelService.getLinkLabels(indexText);

        // Folders recurse; files are kept when they are Markdown. Other entries resolve to undefined.
        const nodes = await Promise.all(entries.map(async ([name, type]) => {
            const childUri = vscode.Uri.joinPath(folderUri, name);

            if (type === vscode.FileType.Directory) {
                const children = await DocumentsTreeProvider.findDocuments(childUri, false);

                return children.length === 0
                    ? undefined
                    : DocumentsTreeProvider.newFolderNode({ children, folderName: name, folderUri: childUri, linkLabels });
            }

            const isMarkdown = type === vscode.FileType.File && MARKDOWN_EXTENSIONS.has(DocumentsTreeProvider.getExtension(name));

            return isMarkdown ? DocumentsTreeProvider.newFileNode({ fileName: name, fileUri: childUri, linkLabels }) : undefined;
        }));

        // Folders first, then files, as a file explorer lists them; each group in file-name order,
        // ignoring case and comparing numbers by value, so the numbered modules keep their order.
        const getRank = (node: DocumentNode): number => (node.children === undefined ? 1 : 0);

        return nodes
            .filter((node): node is DocumentNode => node !== undefined)
            .sort((left, right) => getRank(left) - getRank(right)
                || left.fileName.localeCompare(right.fileName, undefined, { numeric: true, sensitivity: 'base' }));
    }

    /**
     * Returns a file name's extension in lower case, with its dot.
     *
     * @param name - The file name.
     * @returns The extension, or an empty string.
     */
    private static getExtension(name: string): string {
        const lastDot = name.lastIndexOf('.');

        return lastDot > 0 ? name.substring(lastDot).toLowerCase() : '';
    }

    /**
     * Creates a file node that opens the Markdown preview.
     *
     * @param options - The file name, the file on disk, and the names the folder's index gives its documents.
     * @returns The node, named by its index link, its title, or its file name.
     */
    private static async newFileNode(options: FileNodeOptions): Promise<DocumentNode> {
        const { fileName, fileUri, linkLabels } = options;

        // Name the file the way its learning path names it; the file text is read only for its title.
        const fileText = linkLabels.has(fileName.toLowerCase())
            ? ''
            : await DocumentsTreeProvider.readText(fileUri);
        const label = DocumentLabelService.getFileLabel({ fileName, fileText, linkLabels });
        const node = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None) as DocumentNode;

        // The real file URI lets the preview resolve the document's relative links and images.
        node.fileName = fileName;
        node.iconPath = new vscode.ThemeIcon('markdown');
        node.resourceUri = fileUri;
        node.tooltip = fileUri.fsPath;
        node.command = { command: 'markdown.showPreviewToSide', title: 'Open Preview', arguments: [fileUri] };

        return node;
    }

    /**
     * Creates a folder node with its children.
     *
     * @param options - The folder's documents, its name and location, and the names the parent's index gives.
     * @returns The node, named by its index link or its README's title ("data-driven-runs" becomes
     *     "Data-Driven Runs").
     */
    private static async newFolderNode(options: FolderNodeOptions): Promise<DocumentNode> {
        const { children, folderName, folderUri, linkLabels } = options;

        // Name the folder the way the parent's index or its README names it; the README is read only when the
        // index does not name the folder.
        const isLinked = linkLabels.has(`${folderName.toLowerCase()}/`);
        const readmeText = isLinked
            ? ''
            : await DocumentsTreeProvider.readText(vscode.Uri.joinPath(folderUri, 'README.md'));
        const label = DocumentLabelService.getFolderLabel({ folderName, linkLabels, readmeText });
        const node = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed) as DocumentNode;

        node.children = children;
        node.fileName = folderName;
        node.iconPath = new vscode.ThemeIcon('folder');

        return node;
    }

    /**
     * Reads a text file.
     *
     * @param fileUri - The file.
     * @returns The text, or an empty string when the file cannot be read, so a missing index or
     *     title only falls back to the next name.
     */
    private static async readText(fileUri: vscode.Uri): Promise<string> {
        try {
            return new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(fileUri));
        } catch {
            return '';
        }
    }
}

// Module-level contracts sit after the executable code; interfaces come before type aliases, and a
// caller comes before its dependencies (A-Z otherwise).

/**
 * A node of the Documentation tree: a folder with its children, or a Markdown file.
 */
interface DocumentNode extends vscode.TreeItem {
    /** The folder's documents; undefined for a file. */
    children?: DocumentNode[];

    /** The folder or file name on disk, which orders the tree while the label is the reader's name. */
    fileName: string;
}

/**
 * Inputs of {@link DocumentsTreeProvider.newFileNode}.
 */
interface FileNodeOptions {
    /** The file name, with its extension. */
    fileName: string;

    /** The file on disk. */
    fileUri: vscode.Uri;

    /** The names the folder's index gives its documents, keyed by the lower-case file name. */
    linkLabels: ReadonlyMap<string, string>;
}

/**
 * Inputs of {@link DocumentsTreeProvider.newFolderNode}.
 */
interface FolderNodeOptions {
    /** The folder's documents, already read. */
    children: DocumentNode[];

    /** The folder name on disk. */
    folderName: string;

    /** The folder on disk, where its README is read. */
    folderUri: vscode.Uri;

    /** The names the parent's index gives its documents and folders, keyed as the label service keys them. */
    linkLabels: ReadonlyMap<string, string>;
}
