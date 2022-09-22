import {HttpClient} from "../../connection/httpclient";
import {ServiceEndpoint} from "../../connection/serviceendpoint";
import {Logger} from '../../utils/logger';
import {APIResponse, RestServiceT} from "../restservice";
import {HttpResponseParser} from '../../connection/httpresponseparser';
import {InsertOptions} from "./insertoptions";
import {InsertResult} from "./insertresult";
import {FindOptions} from "./findoptions";
import {JSONObject} from "@elastosfoundation/did-js-sdk";
import {CountOptions} from "./countoptions";
import {QueryOptions} from "./queryoptions";
import {UpdateOptions} from "./updateoptions";
import {UpdateResult} from "./updateresult";
import {DeleteOptions} from "./deleteoptions";
import {DatabaseEncryption} from "./databaseencryption";
import {DatabaseAPI} from "./databaseapi";

/**
 * Database service is for save JSON data on the mongo database on hive node.
 *
 * It also support the encryption of the fields of documents.
 *
 * If wants encryptDoc the document, please make sure the document is Object or Map.
 */
export class DatabaseService extends RestServiceT<DatabaseAPI> {
	private static LOG = new Logger("DatabaseService");

	private static API_COLLECTION_ENDPOINT = "/api/v2/vault/db/collection";
	private static API_COLLECTIONS_ENDPOINT = "/api/v2/vault/db/collections";
	private static API_DB_ENDPOINT = "/api/v2/vault/db";

	private encrypt: boolean;
	private databaseEncrypt: DatabaseEncryption;

    constructor(serviceContext: ServiceEndpoint, httpClient: HttpClient) {
		super(serviceContext, httpClient);
        this.encrypt = false;
        this.databaseEncrypt = null;
	}

	async encryptionInit(identifier: string, secureCode: number, storepass: string, nonce: Buffer) {
        this.encrypt = true;
        const cipher = await this.getEncryptionCipher(identifier, secureCode, storepass);
        this.databaseEncrypt = new DatabaseEncryption(cipher, nonce);
        // this.nonce = nonce;
    }

	/**
	 * Lets the vault owner create a collection on database.
	 *
	 * @param collectionName the collection name
	 * @return void
	 */
	async createCollection(collectionName: string): Promise<void>{
        try {
            await (await this.getAPI<DatabaseAPI>(DatabaseAPI))
                .createCollection(await this.getAccessToken(), collectionName);
        } catch (e) {
            await this.handleResponseError(e);
        }
	}

	/**
	 * Lets the vault owner delete a collection on database according to collection name.
	 *
	 * @param collectionName the collection name
	 * @return void
	 */
	async deleteCollection(collectionName: string): Promise<void>{
		try {
            await (await this.getAPI<DatabaseAPI>(DatabaseAPI))
                .deleteCollection(await this.getAccessToken(), collectionName);
		} catch (e){
			await this.handleResponseError(e);
		}
	}

	/**
	* Insert a new document in a given collection.
	*
	* @param collectionName the collection name
	* @param doc The document to insert. Must be a mutable mapping type. If
	*			the document does not have an _id field one will be added automatically
	* @param options bypass_document_validation: (optional) If True, allows
	*				the write to opt-out of document level validation. Default is False.
	* @return Results returned by {@link InsertResult} wrapper
	*/
	async insertOne(collectionName: string, doc: any, options?: InsertOptions): Promise<InsertResult> {
		return await this.insertMany(collectionName, [doc], options);
	}

	/**
	* Insert many new documents in a given collection.
	*
	* @param collectionName the collection name
	* @param docs The document to insert. Must be a mutable mapping type. If the
	*			 document does not have an _id field one will be added automatically.
	* @param options ordered (optional): If True (the default) documents will be inserted on the server serially,
	*				in the order provided. If an error occurs all remaining inserts are aborted. If False, documents
	*				will be inserted on the server in arbitrary order, possibly in parallel, and all document inserts will be attempted.
	*				bypass_document_validation: (optional) If True, allows the write to opt-out of document level validation. Default is False.
	* @return Results returned by {@link InsertResult} wrapper
	*/
	async insertMany(collectionName: string, docs: any[], options?: InsertOptions): Promise<InsertResult>{
		try {
		    const encryptedDocs = this.encrypt ? this.databaseEncrypt.encryptDocs(docs) : docs;
            const response = await (await this.getAPI<DatabaseAPI>(DatabaseAPI))
                .insert(await this.getAccessToken(), collectionName, {
                    "document": encryptedDocs,
                    "options": options
                });
            return new APIResponse<InsertResult>(response).get(<HttpResponseParser<InsertResult>>{
                deserialize(jsonObj: any): InsertResult {
                    let result = new InsertResult();
                    result.setAcknowledge(jsonObj['acknowledge']);
                    result.setInsertedIds(jsonObj['inserted_ids']);
                    return result;
                }});
		} catch (e){
			await this.handleResponseError(e);
		}
	}

 	/**
 	 * Count documents.
 	 *
 	 * @param collectionName the collection name
 	 * @param filter The document of filter
 	 * @param options
 	 *			  skip (number): The number of matching documents to skip before returning results.
 	 *			  limit (number): The maximum number of documents to count. Must be a positive integer. If not provided, no limit is imposed.
 	 *			  maxTimeMS (number): The maximum amount of time to allow this operation to run, in milliseconds.
 	 * @return count size
 	 */
 	async countDocuments(collectionName: string, filter: JSONObject, options?: CountOptions): Promise<number> {
		try {
		    const encryptedFilter = this.encrypt ? this.databaseEncrypt.encryptFilter(filter) : filter;
            const response = await (await this.getAPI<DatabaseAPI>(DatabaseAPI))
                .count(await this.getAccessToken(), collectionName, {
                    "filter": encryptedFilter,
                    "options": options
                });
            return new APIResponse<number>(response).get(<HttpResponseParser<number>>{
                deserialize(jsonObj: any): number {
                    return jsonObj["count"];
                }});
		} catch (e){
			await this.handleResponseError(e);
		}
	}

	/**
	 * Find a specific document.
	 *
	 * @param collectionName the collection name
	 * @param filter optional, a JSON object specifying elements which must be present for a document to be included in the result set
	 * @param options optional,refer to {@link FindOptions}
	 * @return a JSON object document result
	 */
	async findOne(collectionName: string, filter: JSONObject, options?: FindOptions): Promise<JSONObject> {
        const encryptedFilter = this.encrypt ? this.databaseEncrypt.encryptFilter(filter) : filter;
		const docs = await this.findMany(collectionName, encryptedFilter, options);
		DatabaseService.LOG.debug(`fine docs: ${JSON.stringify(docs)}`);

		if (!docs || docs.length === 0) {
		    return null;
        }

		return this.encrypt ? this.databaseEncrypt.encryptDoc(docs[0], false) : docs[0];
	}

	/**
	 * Find many documents.
	 *
	 * @param collectionName the collection name
	 * @param filter optional, a JSON object specifying elements which must be present for a document to be included in the result set
	 * @param options optional,refer to {@link FindOptions}
	 * @return a JsonNode array result of document
	 */

	async findMany(collectionName: string, filter: JSONObject, options?: FindOptions) : Promise<JSONObject[]> {
		try {
            const encryptedFilter = this.encrypt ? this.databaseEncrypt.encryptFilter(filter) : filter;
            const filterStr = encryptedFilter === null ? "" : encodeURIComponent(JSON.stringify(encryptedFilter));
			DatabaseService.LOG.debug("FILTER_STR: " + filterStr);

            const skip = options ? options.skip : 0;
            const limit = options ? options.limit : 0;

            const response = await (await this.getAPI<DatabaseAPI>(DatabaseAPI))
                .find(await this.getAccessToken(), collectionName, filterStr, skip, limit);
            const result = new APIResponse<JSONObject[]>(response).get(<HttpResponseParser<JSONObject[]>>{
                deserialize(jsonObj: any): JSONObject[] {
                    return jsonObj["items"];
                }});

			return this.encrypt ? this.databaseEncrypt.encryptDocs(result, false) : result;
		} catch (e) {
			await this.handleResponseError(e);
		}
	}

 	/**
 	 * Find many documents by many options.
 	 *
 	 * @param collectionName the collection name
 	 * @param filter optional, a JSON object specifying elements which must be present for a document to be included in the result set
 	 * @param options optional,refer to {@link QueryOptions}
 	 * @return a JsonNode array result of document
 	 */
	async query(collectionName: string, filter: JSONObject, options?: QueryOptions): Promise<JSONObject[]> {
		try {
            const encryptedFilter = this.encrypt ? this.databaseEncrypt.encryptFilter(filter) : filter;
            const response = await (await this.getAPI<DatabaseAPI>(DatabaseAPI))
                .query(await this.getAccessToken(), collectionName, {
                    "collection": collectionName,
                    "filter": encryptedFilter,
                    "options": DatabaseService.normalizeSortQueryOptions(options)
                });
            const result = new APIResponse<JSONObject[]>(response).get(<HttpResponseParser<JSONObject[]>>{
                deserialize(jsonObj: any): JSONObject[] {
                    return jsonObj["items"];
                }});
			
			return this.encrypt ? this.databaseEncrypt.encryptDocs(result) : result;
		} catch (e){
			await this.handleResponseError(e);
		}
	}

	/**
 	 * Update an existing document in a given collection.
 	 *
 	 * @param collectionName the collection name
 	 * @param filter A query that matches the document to update.
 	 * @param update The modifications to apply.
 	 * @param options optional, refer to {@link UpdateOptions}
 	 * @return Results returned by {@link UpdateResult} wrapper
 	 */
	async updateOne(collectionName: string, filter: JSONObject, update: JSONObject,
                           options?: UpdateOptions): Promise<UpdateResult> {
		return await this.updateInternal(collectionName, true, filter, update, options);
	}


 	/**
 	 * Update many existing documents in a given collection.
 	 *
 	 * @param collectionName the collection name
 	 * @param filter A query that matches the document to update.
 	 * @param update The modifications to apply.
 	 * @param options optional, refer to {@link UpdateOptions}
 	 * @return Results returned by {@link UpdateResult} wrapper
 	 */
 	async updateMany(collectionName: string, filter: JSONObject, update: JSONObject,
                            options?: UpdateOptions): Promise<UpdateResult> {
		 return await this.updateInternal(collectionName, false, filter, update, options);
	}


 	/**
 	 * Delete an existing document in a given collection.
 	 *
 	 * @param collectionName the collection name
 	 * @param filter A query that matches the document to delete.
 	 * @return Delete result
 	 */
	async deleteOne(collectionName: string, filter: JSONObject): Promise<void> {
		return await this.deleteInternal(collectionName, true, filter);
	}


 	/**
 	 * Delete many existing documents in a given collection.
 	 *
 	 * @param collectionName the collection name
 	 * @param filter A query that matches the document to delete.
 	 * @return Delete result
 	 */
	async deleteMany(collectionName: string, filter: JSONObject): Promise<void> {
		return await this.deleteInternal(collectionName, false, filter);
	}

	private static normalizeSortQueryOptions (options: QueryOptions): QueryOptions {
		if (options && options.sort) {
			let sortQuery = [];
			for (const s of options.sort) {
				sortQuery.push([s.key, s.order])
			}
			options.sort = sortQuery;
		}
		return options;
	}

	private async updateInternal(collectionName: string, isOnlyOne: boolean, filter: JSONObject, update: JSONObject,
                                 options?: UpdateOptions): Promise<UpdateResult> {
		try {
            const encryptedFilter = this.encrypt ? this.databaseEncrypt.encryptFilter(filter) : filter;
            const encryptedUpdate = this.encrypt ? this.databaseEncrypt.encryptUpdate(update) : update;
            const response = await (await this.getAPI<DatabaseAPI>(DatabaseAPI))
                .update(await this.getAccessToken(), collectionName, isOnlyOne, {
                    "filter": encryptedFilter,
                    "update": encryptedUpdate,
                    "options": options
                });
            return new APIResponse<UpdateResult>(response).get(<HttpResponseParser<UpdateResult>>{
                deserialize(jsonObj: any): UpdateResult {
                    const result = new UpdateResult();
                    result.setAcknowledged(jsonObj['acknowledged']);
                    result.setMatchedCount(jsonObj['matched_count']);
                    result.setModifiedCount(jsonObj['modified_count']);
                    result.setUpsertedId(jsonObj['upserted_id']);
                    return result;
                }});
		} catch (e){
			await this.handleResponseError(e);
		}
	}

	private async deleteInternal(collectionName: string, isOnlyOne:boolean, filter: JSONObject,
                                 options?: DeleteOptions): Promise<void> {
		try {
            const encryptedFilter = this.encrypt ? this.databaseEncrypt.encryptFilter(filter) : filter;
            const response = await (await this.getAPI<DatabaseAPI>(DatabaseAPI))
                .delete(await this.getAccessToken(), collectionName, isOnlyOne, {
                    "filter": encryptedFilter,
                    "options": options
                });
            return new APIResponse<void>(response).get();
		} catch (e){
			await this.handleResponseError(e);
		}
	}
}
