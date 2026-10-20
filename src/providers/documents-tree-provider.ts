/*
 * The Documentation view of the Test Wright activity bar: the learning paths shipped in the
 * extension's resources.docs folder, laid out as the G4 Engine Client lays out a project's docs.
 *
 * Like a file explorer, folders come first and files after them, A-Z within each group: one folder
 * per learning path ("run-your-bots" shows as "Run Your Bots"), then the root index
 * (test-wright-learning.md, shown as "Test Wright Learning Paths"). Only Markdown files are
 * listed, so folders without Markdown (images, practice) are left out. Selecting a document opens
 * the Markdown preview from its real location, so relative links and images work.
 */
import * as vscode from 'vscode';

// The view id declared in package.json.
export const DOCUMENTS_VIEW_ID = 'g4TestWrightDocuments';

// The view-title command that rebuilds the tree.
const REFRESH_COMMAND = 'TestWright.RefreshDocuments';

// The extension folder that holds the learning paths.
const DOCUMENTS_FOLDER = 'resources.docs';

// The root index file and the label it shows (the Engine Client names its copy "G4 Learning Paths").
const INDEX_FILE_NAME = 'test-wright-learning.md';
const INDEX_LABEL = 'Test Wright Learning Paths';

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
     * @param isRoot - Whether this is the docs root (where the index file is found).
     * @returns Folders first, then files; A-Z within each group.
     *
     * @remarks
     * Folders without Markdown are left out, and an unreadable folder or file yields no node
     * instead of failing the whole tree.
     */
    private static async findDocuments(folderUri: vscode.Uri, isRoot: boolean): Promise<DocumentNode[]> {
        // An unreadable folder contributes nothing.
        let entries: [string, vscode.FileType][];

        try {
            entries = await vscode.workspace.fs.readDirectory(folderUri);
        } catch {
            return [];
        }

        // Folders recurse; files are kept when they are Markdown. Other entries resolve to undefined.
        const nodes = await Promise.all(entries.map(async ([name, type]) => {
            const childUri = vscode.Uri.joinPath(folderUri, name);

            if (type === vscode.FileType.Directory) {
                const children = await DocumentsTreeProvider.findDocuments(childUri, false);

                return children.length === 0 ? undefined : DocumentsTreeProvider.newFolderNode(name, children);
            }

            const isMarkdown = type === vscode.FileType.File && MARKDOWN_EXTENSIONS.has(DocumentsTreeProvider.getExtension(name));

            return isMarkdown ? DocumentsTreeProvider.newFileNode(name, childUri, isRoot) : undefined;
        }));

        // Folders first, then files, as a file explorer lists them; A-Z within each group, ignoring
        // case and comparing numbers by value so "2" comes before "10".
        const getRank = (node: DocumentNode): number => (node.children === undefined ? 1 : 0);
        const getLabel = (node: DocumentNode): string => (typeof node.label === 'string' ? node.label : '');

        return nodes
            .filter((node): node is DocumentNode => node !== undefined)
            .sort((left, right) => getRank(left) - getRank(right)
                || getLabel(left).localeCompare(getLabel(right), undefined, { numeric: true, sensitivity: 'base' }));
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
     * @param name - The file name.
     * @param fileUri - The file on disk.
     * @param isRoot - Whether the file sits at the docs root.
     * @returns The node.
     */
    private static newFileNode(name: string, fileUri: vscode.Uri, isRoot: boolean): DocumentNode {
        // The root index reads as the learning paths' title; other files keep their names.
        const isIndex = isRoot && name.toLowerCase() === INDEX_FILE_NAME;
        const extension = DocumentsTreeProvider.getExtension(name);
        const label = isIndex ? INDEX_LABEL : name.substring(0, name.length - extension.length);
        const node: DocumentNode = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

        // The real file URI lets the preview resolve the document's relative links and images.
        node.iconPath = new vscode.ThemeIcon('markdown');
        node.resourceUri = fileUri;
        node.tooltip = fileUri.fsPath;
        node.command = { command: 'markdown.showPreviewToSide', title: 'Open Preview', arguments: [fileUri] };

        return node;
    }

    /**
     * Creates a folder node with its children.
     *
     * @param name - The folder name, in lower kebab case.
     * @param children - The folder's documents.
     * @returns The node, labeled in Title Case ("run-your-bots" becomes "Run Your Bots").
     */
    private static newFolderNode(name: string, children: DocumentNode[]): DocumentNode {
        const label = name
            .split('-')
            .filter((word) => word !== '')
            .map((word) => word.charAt(0).toUpperCase() + word.substring(1))
            .join(' ');
        const node: DocumentNode = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);

        node.children = children;
        node.iconPath = new vscode.ThemeIcon('folder');

        return node;
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
}
