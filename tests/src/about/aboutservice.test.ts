import {NodeInfo, NodeVersion, ServiceEndpoint, Logger} from "@elastosfoundation/hive-js-sdk";
import { TestData } from "../config/testdata";

describe.skip("test about service", () => {
    const LOG = new Logger('aboutservice.test');

	let testData: TestData;
    let vaultSubscription: VaultSubscription;

    beforeAll(async () => {
		testData = await TestData.getInstance("aboutservice.test");
        vaultSubscription = new VaultSubscription(
            testData.getAppContext(),
            testData.getProviderAddress()
        );
        try {
            await vaultSubscription.subscribe();
        } catch (e){
            console.log("vault is already subscribed");
        }
	});

    test("testGetNodeVersion", async () => {
		let nodeVersion: NodeVersion = await vaultSubscription.getNodeVersion();
		expect(nodeVersion).not.toBeNull();
        LOG.info("Hive Node version: {}", nodeVersion.toString());
    });

    test("testGetCommitId", async () => {
		let commitId = await vaultSubscription.getLatestCommitId();
		expect(commitId).not.toBeNull();
        LOG.info("Hive Node commit id: {}", commitId);
    });

    test("testGetNodeInfo", async () => {
        const nodeInfo: NodeInfo = await vaultSubscription.getNodeInfo();
        expect(nodeInfo).not.toBeNull();
        expect(nodeInfo.getServiceDid()).not.toBeNull();
        expect(nodeInfo.getOwnerDid()).not.toBeNull();
        expect(nodeInfo.getOwnershipPresentation()).not.toBeNull();
        expect(nodeInfo.getName()).not.toBeNull();
        expect(nodeInfo.getEmail()).not.toBeNull();
        expect(nodeInfo.getDescription()).not.toBeNull();
        expect(nodeInfo.getVersion()).not.toBeNull();
        expect(nodeInfo.getLastCommitId()).not.toBeNull();
    });
});
