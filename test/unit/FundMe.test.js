const { deployments, ethers, getNamedAccounts } = require("hardhat");
const { assert } = require("chai");

describe("FundMe", async function () {
  let fundMe;
  let deployer;
  let mockV3Aggregator;
  const sendValue = ethers.utils.parseEther("1");
  beforeEach(async function () {
    // deploy our fundMe contract with hardhat deploy
    // Using Hardhat-deploy
    // const accounts = await ethers.getSigners();
    // const accountZero = accounts[0];
    deployer = (await getNamedAccounts()).deployer;
    await deployments.fixture(["all"]);
    fundMe = await ethers.getContract("FundMe", deployer);
    mockV3Aggregator = await ethers.getContract("MockV3Aggregator", deployer);
  });

  describe("constructor", async function () {
    it("sets the aggregate addresses correctly", async function () {
      const response = await fundMe.priceFeed();
      assert.equal(response, mockV3Aggregator.address);
    });
  });

  // Test Fund
  describe("fund", async function () {
    it("Fails if you don't send enough ETH", async function () {
      await expect(fundMe.fund()).to.be.revertedWith("You need to send ETH");
    });
    it("updated the amount funded data structure", async function () {
      await fundMe.fund({ value: sendValue });
      const response = await fundMe.addressToAmountFunded(deployer.address);
      assert.equal(response.toString(), sendValue.toString());
    });
    it("Adds funder to array of funders", async function () {
      await fundMe.fund({ value: sendValue });
      const funder = await fundMe.funders(0);
      assert.equal(funder, deployer);
    });
  });

  describe("withdraw", async function () {
    beforeEach(async function () {
      await fundMe.fund({ value: sendValue });
    });

    it("withdraw ETH from a single founder", async function () {
      // Arrange
      const startingFundMeBalance = fundMe.provider.getBalance(fundMe.address);
      const startingDeployerBalance = fundMe.provider.getBalance(deployer);
      // Act
      const transactionResponse = await fundMe.withdraw();
      const transactionReceipt = await transactionResponse.wait(1);
      const { gasUsed, effectiveGasPrice } = transactionReceipt;
      const gasCost = gasUsed.mul(effectiveGasPrice);
      const endingFundMeBalance = await fundMe.provider.getBalance(
        fundMe.address
      );
      const endingDeployerBalance = await fundMe.provider.getBalance(deployer);
      // Assert
      assert.equal(endingFundMeBalance, 0);
      assert.equal(
        startingFundMeBalance.add(startingDeployerBalance).toString(),
        endingDeployerBalance.add(gasCost).toString()
      );

      // Make sure funders are reset properly
      await expect(fundme.funders(0)).to.be.reverted;

      for (i = 1; i < 6; i++) {
        assert.equal(
          await fundMe.addressToAmountFunded(accounts[i].address),
          0
        );
      }
    });

    it("Only allows the owner to withdraw", async function () {
      const accounts = ethers.getSigners();
      const attacker = accounts[1];
      const attackerConnectedContract = fundMe.connect(attacker);
      await expect(attackerConnectedContract.withdraw()).to.be.revertedWith(
        "Only the owner can withdraw"
      );
    });
  });
});
