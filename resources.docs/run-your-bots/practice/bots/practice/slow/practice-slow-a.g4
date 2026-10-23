{
    "authentication": {
        "token": "",
        "password": "",
        "username": ""
    },
    "driverParameters": {
        "capabilities": {
            "alwaysMatch": {
                "browserName": "Uia",
                "uia:options": {
                    "label": "practice"
                }
            }
        },
        "driver": "SimulatorDriver",
        "driverBinaries": ".",
        "firstMatch": [
            {}
        ]
    },
    "reference": {
        "id": "practice-slow-a",
        "name": "practice-slow-a",
        "description": "",
        "tags": [
            "slow"
        ]
    },
    "settings": {
        "automationSettings": {
            "loadTimeout": 60000,
            "maxParallel": 1,
            "returnStructuredResponse": true,
            "searchTimeout": 15000
        },
        "screenshotsSettings": {
            "outputFolder": ".",
            "convertToBase64": true,
            "returnScreenshots": true,
            "onExceptionOnly": false
        },
        "pluginsSettings": {
            "externalRepositories": [],
            "servers": {}
        },
        "exceptionsSettings": {
            "returnExceptions": true
        },
        "environmentsSettings": {
            "defaultEnvironment": "SystemParameters",
            "returnEnvironment": true
        }
    },
    "stages": [
        {
            "reference": {
                "id": "practicestage1",
                "name": "G4™ Default Stage",
                "description": "A container that holds jobs."
            },
            "jobs": [
                {
                    "reference": {
                        "id": "practicejob1",
                        "name": "G4™ Default Job",
                        "description": "A container that holds actions."
                    },
                    "rules": [
                        {
                            "$type": "Action",
                            "pluginName": "Wait",
                            "reference": {
                                "id": "practice0016"
                            },
                            "capabilities": {
                                "displayName": "Wait 8 Seconds"
                            },
                            "locator": "Xpath",
                            "argument": "8000"
                        },
                        {
                            "$type": "Action",
                            "pluginName": "CloseBrowser",
                            "reference": {
                                "id": "practice0017"
                            },
                            "capabilities": {
                                "displayName": "Close Browser"
                            },
                            "locator": "Xpath"
                        }
                    ]
                }
            ]
        }
    ]
}
