import { initGeb } from "./geb";
import { sendAlert } from "../discord/alert";

import { initOracle, updateResult, updateCollateralPrice } from "./oracle";
import { prepareTx, multiplyWad } from "./common";
import { botSendTx } from "./wallets/bot";
import { formatDataNumber, getExplorerBaseUrlFromName } from "./common";

const getTokenPrice = async (network, symbol) => {
  try {
    const geb = initGeb(network);
    const tokenList = Object.values(geb.tokenList).filter((token) =>
      ["FTRG", "STN", "TOTEM"].includes(token.symbol)
    );
    const token = tokenList.find((token) => token.symbol === symbol);
    if (!token) throw "Token not found";
    const params = await geb.contracts.oracleRelayer.cParams(
      token.bytes32String
    );
    const { oracle: oracleAddress } = params;
    const oracle = initOracle(network, oracleAddress);
    const { result: priceBn } = await oracle.getResultWithValidity();
    return formatDataNumber(priceBn?.toString() || "0", 18, 2, true);
  } catch (e) {
    console.log("getTokenPrice failed");
  }
};

export const updateTokenPrice = async (network, symbol, price, execute) => {
  try {
    const geb = initGeb(network);
    const tokenList = Object.values(geb.tokenList).filter((token) =>
      ["FTRG", "STN", "TOTEM"].includes(token.symbol)
    );
    const token = tokenList.find((token) => token.symbol === symbol);
    if (!token) throw "Token not found";

    const params = await geb.contracts.oracleRelayer.cParams(
      token.bytes32String
    );
    const { oracle: delayedOracleAddress } = params;

    // Delayed Oracle
    const delayedOracle = initOracle(network, delayedOracleAddress);
    const denominatedOracleAddress = await delayedOracle.priceSource();
    const delayedOracleSymbol = await delayedOracle.symbol();

    // Denominated Oracle
    const denominatedOracle = initOracle(network, denominatedOracleAddress);
    const oracleForTestnetAddress = await denominatedOracle.priceSource();
    const denominatedOracleSymbol = await denominatedOracle.symbol();
    const denominationOracleAddress =
      await denominatedOracle.denominationPriceSource();

    // OracleForTestnet
    const oracleForTestnet = initOracle(network, oracleForTestnetAddress);
    const oracleForTestnetSymbol = await oracleForTestnet.symbol();

    // Denomination Price Source
    const denominationPriceSource = initOracle(
      network,
      denominationOracleAddress
    );
    const denominationPriceSourceSymbol =
      await denominationPriceSource.symbol();

    const getOracleResults = async () => {
      const { result: delayedOracleNextPriceBn } =
        await delayedOracle.getNextResultWithValidity();
      const { result: delayedOraclePriceBn } =
        await delayedOracle.getResultWithValidity();
      const { result: denominatedOraclePriceBn } =
        await denominatedOracle.getResultWithValidity();
      const { result: oracleForTestnetPriceBn } =
        await oracleForTestnet.getResultWithValidity();
      const { result: denominationPriceBn } =
        await denominationPriceSource.getResultWithValidity();
      return {
        delayedOraclePriceBn,
        delayedOracleNextPriceBn,
        denominatedOraclePriceBn,
        oracleForTestnetPriceBn,
        denominationPriceBn,
      };
    };

    const before = await getOracleResults();

    // Update price
    let setPriceAndValidityHash;
    let updateResultHash;
    let updateCollateralPriceHash;

    if (execute) {
      const txData =
        await oracleForTestnet.populateTransaction.setPriceAndValidity(
          price,
          true
        );

      const tx = await prepareTx({
        data: txData,
        method: "setPriceAndValidity",
        contractName: "OracleForTestnet",
        textTitle: "Updates token price manually (test tokens only)",
        network,
      });
      const txResponse = await botSendTx({ unsigned: txData, network });
      await tx.update({ hash: txResponse.hash });
      await txResponse.wait();
      setPriceAndValidityHash = txResponse.hash;

      // Update the delayed oracle
      updateResultHash = await updateResult(network, token.bytes32String);
      // Update the system price for the collateral
      updateCollateralPriceHash = await updateCollateralPrice(
        network,
        token.bytes32String
      );
    }

    const shouldUpdate = await delayedOracle.shouldUpdate();

    let receiptText = "";
    receiptText = receiptText.concat("\n", `1. setPriceAndValidityHash() - `);
    receiptText = receiptText.concat(
      setPriceAndValidityHash
        ? `[receipt](${getExplorerBaseUrlFromName(
            network
          )}tx/${setPriceAndValidityHash})`
        : "Not updated"
    );
    receiptText = receiptText.concat("\n", `2. updateResult() - `);
    receiptText = receiptText.concat(
      updateResultHash
        ? `[receipt](${getExplorerBaseUrlFromName(
            network
          )}tx/${updateResultHash})`
        : "Not updated"
    );
    receiptText = receiptText.concat("\n", `3. updateCollateralPrice() - `);
    receiptText = receiptText.concat(
      updateCollateralPriceHash
        ? `[receipt](${getExplorerBaseUrlFromName(
            network
          )}tx/${updateCollateralPriceHash})`
        : "Not updated"
    );

    const sampleOutputBn = multiplyWad(price, before.denominationPriceBn);
    let sampleCalculationText = `*Input: ${price} ${symbol} / ETH*
*Result ${formatDataNumber(sampleOutputBn?.toString() || "0", 18, 5, true)}*`;
    sampleCalculationText = sampleCalculationText.concat(
      `\n\`\`\`\nDenominatedOracle Price = multiplyWad(OracleForTestnetPrice, DenominationOraclePrice)
${sampleOutputBn} = ${price} * ${before.denominationPriceBn} / 1000000000000000000\n\`\`\``
    );

    const after = await getOracleResults();
    const beforePrice = formatDataNumber(
      before.delayedOraclePriceBn?.toString() || "0",
      18,
      5,
      true
    );
    const afterPrice = formatDataNumber(
      after.delayedOraclePriceBn?.toString() || "0",
      18,
      5,
      true
    );

    let fields = [
      {
        name: "",
        value: `🪙 **[${token.symbol}](${getExplorerBaseUrlFromName(
          network
        )}address/${token.address})**
Price Change **${beforePrice}** ${execute ? `➡️ **${afterPrice}**` : ""}`,
      },
      {
        name: "Sample calculation",
        value: sampleCalculationText,
      },
      { name: "Transactions", value: receiptText },
      {
        name: `DelayedOracle ${delayedOracleSymbol} ${
          shouldUpdate ? "🟢 Update Ready" : "❄️ Cooling"
        }`,
        value: `${before.delayedOraclePriceBn}
${before.delayedOracleNextPriceBn} Next
${
  execute
    ? `↓
${after.delayedOraclePriceBn}
${after.delayedOracleNextPriceBn} Next
[contract](${getExplorerBaseUrlFromName(
        network
      )}address/${delayedOracleAddress})`
    : ""
}`,
      },
      {
        name: `DenominatedOracle ${denominatedOracleSymbol}`,
        value: `${before.denominatedOraclePriceBn}
${
  execute
    ? `↓
${after.denominatedOraclePriceBn}
[contract](${getExplorerBaseUrlFromName(
        network
      )}address/${denominatedOracleAddress})`
    : ""
}`,
      },
      {
        name: `Denomination Oracle ${denominationPriceSourceSymbol}`,
        value: `${before.denominationPriceBn}
        ${
          execute
            ? `↓
${after.denominationPriceBn}
[contract](${getExplorerBaseUrlFromName(
                network
              )}address/${denominationOracleAddress})`
            : ""
        }`,
      },
      {
        name: `OracleForTestnet ${oracleForTestnetSymbol}`,
        value: `${before.oracleForTestnetPriceBn} ${symbol} / ETH
${
  execute
    ? `↓
${after.oracleForTestnetPriceBn} ${symbol} / ETH
[contract](${getExplorerBaseUrlFromName(
        network
      )}address/${oracleForTestnetAddress})`
    : ""
}`,
      },
    ];
    await sendAlert({
      embed: {
        color: execute ? 1900316 : 0xffffd0,
        title: `🐞 Debug - Token Price | ${network}`,
        footer: { text: new Date().toString() },
        description: execute
          ? ""
          : `💡 Helpful code snippets:
\`\`\`js
// Calculating price for denominated oracles
function read() external view returns (uint256 _result) {
  uint256 _priceSourceValue = priceSource.read();
  uint256 _denominationPriceSourceValue = denominationPriceSource.read();

  _priceSourceValue = inverted ? WAD.wdiv(_priceSourceValue) : _priceSourceValue;

  return _priceSourceValue.wmul(_denominationPriceSourceValue);
}

// WAD multiplication in JavaScript 
const WAD = BigNumber.from("1000000000000000000");

export const multiplyWad = (wad1, wad2) => {
  const result = BigNumber.from(wad1).mul(BigNumber.from(wad2)).div(WAD);

  return result.toString();
};
\`\`\``,
        fields: fields.slice(0, 24), // 25 item limit
      },
      channelName: "action",
    });
  } catch (e) {
    console.log("updateTokenPrice failed");
    console.log(e);
  }
};
