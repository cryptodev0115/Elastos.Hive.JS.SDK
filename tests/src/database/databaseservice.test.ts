import {
    VaultSubscription, DatabaseService, AlreadyExistsException,
    InsertOptions, FindOptions, CountOptions, UpdateOptions, QueryOptions,
    AscendingSortItem, CollectionNotFoundException, NodeRPCException
} from "../../../src";
import { TestData } from "../config/testdata";

describe("test database services", () => {
    let vaultSubscription: VaultSubscription;
    let databaseService: DatabaseService;

    let COLLECTION_NAME = "works";
    let COLLECTION_NAME_NOT_EXIST = "works_not_exists";

    beforeAll(async () => {
        const testData = await TestData.getInstance("databaseservice.tests");

        vaultSubscription = new VaultSubscription(
            testData.getUserAppContext(),
            testData.getProviderAddress());
        
        try {
            await vaultSubscription.subscribe();
        } catch (e) {
            if (e instanceof NodeRPCException) {
                if (e instanceof AlreadyExistsException) {
                    console.log("vault is already subscribed");
                } else {
                    console.log("unexpected hive js exception");
                    throw e;
                }
            } else {
                console.log("not got a hive js exception");
            }
        }

        databaseService = testData.newVault().getDatabaseService();
    });

    test("testCreateCollection", async () => {
        await deleteCollectionAnyway();
        await expect(databaseService.createCollection(COLLECTION_NAME)).resolves.not.toThrow();
    });

    test("testCreateCollection4AlreadyExistsException", async () => {
        let collectionName = `collection_${Date.now().toString()}`; 
        await databaseService.createCollection(collectionName);
        await expect(databaseService.createCollection(collectionName)).rejects.toThrow(AlreadyExistsException);
        await databaseService.deleteCollection(collectionName);
    });   

    test("testInsertOne", async () => {
        let docNode = new Map();
        docNode['author'] = 'john doe1';
        docNode['title'] = 'Eve for Dummies1';

        let result = await databaseService.insertOne(COLLECTION_NAME, docNode, new InsertOptions(false, false, true));
        expect(result).not.toBeNull();
        expect(result.getInsertedIds().length).toEqual(1);
    });

    test("testInsertOne4NotFoundException", async () => {
        let docNode = {"author": "john doe1", "title": "Eve for Dummies1"};
        await expect(databaseService.insertOne(COLLECTION_NAME_NOT_EXIST, docNode, new InsertOptions(false, false)))
            .rejects.toThrow(CollectionNotFoundException);
 	});

    test("testInsertMany", async () => {
        let nodes = [{"author": "john doe2", "title": "Eve for Dummies2"},
                     {"author": "john doe3", "title": "Eve for Dummies3"}];
        let result = await databaseService.insertMany(COLLECTION_NAME, nodes, new InsertOptions(false, true)); 
        expect(result).not.toBeNull();
        expect(result.getInsertedIds().length).toEqual(2);
    });

    test("testInsertMany4NotFoundException", async () => {
        let nodes = [{"author": "john doe2", "title": "Eve for Dummies2"},
                     {"author": "john doe3", "title": "Eve for Dummies3"}];
        await expect(databaseService.insertMany(COLLECTION_NAME_NOT_EXIST, nodes, new InsertOptions(false, false)))
            .rejects.toThrow(CollectionNotFoundException);
    });

    test("testFindOne", async () => {
        //setup
        let collectionName = getUniqueName("testFindOne");
        await databaseService.createCollection(collectionName);
        let nodes = {"author": "john doe1", "title": "Eve for Dummies1"};
        await expect(databaseService.insertOne(collectionName, nodes)).resolves.not.toThrow();

        let query = {"author": "john doe1"};
        let result = await databaseService.findOne(collectionName, query);
        expect(result).not.toBeNull();
    });

    test("testFindOne4NotFoundException", async () => {
		let query = {"author": "john doe1"};
        await expect(databaseService.findOne(getUniqueName("testFindOne4NotFoundException"), query))
            .rejects.toThrow(CollectionNotFoundException);
	});
   
    test("testFindMany", async () => {
        let query = {"author": "john doe1"};
        await expect(databaseService.findMany(COLLECTION_NAME, query)).resolves.not.toThrow();
    });

    test("testFindMany4NotFoundException", async () => {
        let query = {"author": "john doe1"};
        await expect(databaseService.findMany(COLLECTION_NAME_NOT_EXIST, query)).rejects.toThrow(CollectionNotFoundException);
    });

    test("testQuery", async () => {
        let query = {"author": "john doe1"};
        await expect(databaseService.query(COLLECTION_NAME, query, null)).resolves.not.toBeNull();
        await expect(databaseService.query(COLLECTION_NAME, query)).resolves.not.toBeNull();
    });

    test("testQuery4NotFoundException", async () => {
        let query = {"author": "john doe1"};
        await expect(databaseService.query(COLLECTION_NAME_NOT_EXIST, query)).rejects.toThrow(CollectionNotFoundException);
    });

    test("testQueryWithOptions", async () => {
        let query = {"author": "john doe1"};
        let options: QueryOptions = new QueryOptions();
        options.sort = [new AscendingSortItem("_id")];
        await expect(databaseService.query(COLLECTION_NAME, query, options)).resolves.not.toBeNull();
    });

    test("testCountDoc", async () => {
        let filter = { "author": "john doe1" };
        let countOptions = new CountOptions();
        countOptions.skip = 0;
        countOptions.limit = 1;
        countOptions.maxTimeMS = 1000000000;
        await expect(databaseService.countDocuments(COLLECTION_NAME, filter, countOptions)).resolves.not.toBeNull();
    });

    test("testCountDoc4NotFoundException", async () => {
        let filter = { "author": "john doe1" };
        let countOptions = new CountOptions();
        countOptions.skip = 0;
        countOptions.limit = 1;
        countOptions.maxTimeMS = 1000000000;
        await expect(databaseService.countDocuments(COLLECTION_NAME_NOT_EXIST, filter, countOptions))
            .rejects.toThrow(CollectionNotFoundException);
    });

    test("testUpdateOne", async () => {
        let filter = { "author": "john doe1" };
        let docNode = { "author": "john doe1", "title": "Eve for Dummies1_1" };
        let updateNode = { "$set": docNode };
        await expect(databaseService.updateOne(COLLECTION_NAME, filter, updateNode, new UpdateOptions(false, true))).resolves.not.toBeNull();
    });

    test("testUpdateInsertIfNotExists", async () => {
        /** The inserted document:
        {
            "_id": ObjectId("6241471ab042663cc9f179e7"),
            "author": "john doe4",
            "title": "title": "Eve for Dummies4"
        }
        */
        let filter = { "author": "john doe4" };
        let updateNode = { "$setOnInsert": { "title": "Eve for Dummies4" } };
        await expect(databaseService.updateOne(COLLECTION_NAME, filter, updateNode, new UpdateOptions(true, true))).resolves.not.toBeNull();
    });

    test("testUpdateOneNoOptions", async () => {
        let filter = { "author": "john doe1" };
        let docNode = { "author": "john doe1", "title": "Eve for Dummies1_1" };
        let updateNode = { "$set": docNode };
        await expect(databaseService.updateOne(COLLECTION_NAME, filter, updateNode)).resolves.not.toBeNull();
    });

    test("testUpdateOne4NotFoundException", async () => {
        let filter = { "author": "john doe1" };
        let docNode = { "author": "john doe1", "title": "Eve for Dummies1_1" };
        let updateNode = { "$set": docNode };
        await expect(databaseService.updateOne(COLLECTION_NAME_NOT_EXIST, filter, updateNode, new UpdateOptions(false, true)))
            .rejects.toThrow(CollectionNotFoundException);
    });

    test("testUpdateMany", async () => {
        let filter = { "author": "john doe1" };
        let docNode = { "author": "john doe1", "title": "Eve for Dummies1_2" };
        let updateNode = { "$set": docNode };
        await expect(databaseService.updateMany(COLLECTION_NAME, filter, updateNode, new UpdateOptions(false, true))).resolves.not.toBeNull();
    });

    test("testUpdateMany4NotFoundException", async () => {
        let filter = { "author": "john doe1" };
        let docNode = { "author": "john doe1", "title": "Eve for Dummies1_2" };
        let updateNode = { "$set": docNode };
        await expect(databaseService.updateMany(COLLECTION_NAME_NOT_EXIST, filter, updateNode, new UpdateOptions(false, true))).rejects.toThrow(CollectionNotFoundException);
    });

    test("testDeleteOne", async () => {
        await expect(databaseService.deleteOne(COLLECTION_NAME, { "author": "john doe2" })).resolves.not.toThrow();
    });

    test("testDeleteOne4NotFoundException", async () => {
        await expect(databaseService.deleteOne(COLLECTION_NAME_NOT_EXIST, { "author": "john doe2" })).rejects.toThrow(CollectionNotFoundException);
    });

    test("testDeleteMany", async () => {
        await expect(databaseService.deleteMany(COLLECTION_NAME, { "author": "john doe2" })).resolves.not.toThrow();
    });

    test("testDeleteMany4NotFoundException", async () => {
        await expect(databaseService.deleteMany(COLLECTION_NAME_NOT_EXIST, { "author": "john doe2" })).rejects.toThrow(CollectionNotFoundException);
    });

    test("testDeleteCollection", async () => {
        await expect(databaseService.deleteCollection(COLLECTION_NAME)).resolves.not.toThrow();
    });

    function getUniqueName(prefix: string){
        return `${prefix}_${Date.now().toString()}`;
    }

    async function deleteCollectionAnyway() {
        try {
            await databaseService.deleteCollection(COLLECTION_NAME);
        } catch (e) {
            // No error
        }
    }
});