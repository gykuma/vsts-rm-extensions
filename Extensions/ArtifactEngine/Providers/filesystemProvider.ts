import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';

import * as models from '../Models';
import { Logger } from '../Engine/logger';

export class FilesystemProvider implements models.IArtifactProvider {
    constructor(rootLocation: string) {
        this._rootLocation = rootLocation;
    }

    getRootItems(): Promise<models.ArtifactItem[]> {
        return this.getItems(this._rootLocation);
    }

    getArtifactItems(artifactItem: models.ArtifactItem): Promise<models.ArtifactItem[]> {
        var itemsPath = artifactItem.metadata["downloadUrl"];
        return this.getItems(itemsPath, artifactItem.path);
    }

    getArtifactItem(artifactItem: models.ArtifactItem): Promise<NodeJS.ReadableStream> {
        var promise = new Promise<NodeJS.ReadableStream>(async (resolve, reject) => {
            var itemPath: string = artifactItem.metadata['downloadUrl'];
            try {
                var contentStream = fs.createReadStream(itemPath);
                resolve(contentStream);
            } catch (error) {
                reject(error);
            }
        });

        return promise;
    }

    public putArtifactItem(item: models.ArtifactItem, stream: NodeJS.ReadableStream): Promise<models.ArtifactItem> {
        return new Promise(async (resolve, reject) => {
            const outputFilename = path.join(this._rootLocation, item.path);

            // create parent folder if it has not already been created
            const folder = path.dirname(outputFilename);
            this.ensureDirectoryExistence(folder);

            Logger.logMessage('Downloading ' + item.path + ' to ' + outputFilename);
            const outputStream = fs.createWriteStream(outputFilename);
            stream.pipe(outputStream);
            stream.on("end",
                () => {
                    Logger.logMessage(`Downloaded '${item.path}' to '${outputFilename}'`);
                    if (!item.metadata) {
                        item.metadata = {};
                    }
                    
                    item.metadata[models.Constants.DestinationUrlKey] = outputFilename;

                    resolve(item);
                });
            stream.on("error",
                (error) => {
                    reject(error);
                });
        });
    }

    private getItems(itemsPath: string, parentRelativePath?: string): Promise<models.ArtifactItem[]> {
        var promise = new Promise<models.ArtifactItem[]>((resolve, reject) => {
            var items: models.ArtifactItem[] = [];
            fs.readdir(itemsPath, (error, files) => {
                if (!!error) {
                    Logger.logError("Unable to read directory " + itemsPath + ". Error: " + error);
                }

                for (var index = 0; index < files.length; index++) {
                    var file = files[index];
                    var filePath = path.join(itemsPath, file);

                    // do not follow symbolic link
                    var itemStat = fs.lstatSync(filePath)
                    var item: models.ArtifactItem = <models.ArtifactItem>{
                        itemType: itemStat.isFile() ? models.ItemType.File : models.ItemType.Folder,
                        path: parentRelativePath ? path.join(parentRelativePath, file) : file,
                        fileLength: itemStat.size,
                        lastModified: itemStat.mtime,
                        metadata: { "downloadUrl": filePath }
                    }

                    items = items.concat(item);
                }

                resolve(items);
            });
        });

        return promise;
    }

    private ensureDirectoryExistence(folder) {
        if (!this._createdFolders.hasOwnProperty(folder)) {
            var dirName: string = path.dirname(folder);
            if (fs.existsSync(folder)) {
                return;
            }

            this.ensureDirectoryExistence(dirName);
            fs.mkdirSync(folder);
            this._createdFolders[folder] = true;
        }
    }

    private _rootLocation: string;
    private _createdFolders: { [key: string]: boolean } = {};
}