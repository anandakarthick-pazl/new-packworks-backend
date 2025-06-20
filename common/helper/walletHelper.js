import db from "../../common/models/index.js";

// const Client = db.Client;
const WalletHistory = db.WalletHistory;

/**
 * Adds a new wallet history entry
 * @param {Object} params
 * @param {'credit' | 'debit'} params.type
 * @param {number} params.client_id
 * @param {number} params.amount
 * @param {number} params.company_id
 * @param {string} params.reference_number
 * @param {number} params.created_by
 */

const addWalletHistory = async ({
  type,
  client_id,
  amount,
  company_id,
  reference_number,
  created_by,
}) => {
  try {
    const result = await WalletHistory.create({
      type,
      client_id,
      amount,
      company_id,
      refference_number: reference_number, // If this column is a typo, consider fixing it in DB/model
      created_by,
      created_at: new Date(),
    });

    return result;
  } catch (err) {
    console.error("Failed to create wallet history:", err);
    throw new Error("Wallet history creation failed");
  }
};

export default addWalletHistory;
