const { getPatientsByPhone } = require("../utils/database");

const identifyPatientNode = async (state) => {
  if (state.patientRecords !== undefined) return {};

  if (!state.userPhone) {
    return { patientRecord: null, patientRecords: [] };
  }

  try {
    const patients = await getPatientsByPhone(state.userPhone);

    if (patients.length === 0) {
      return { patientRecord: null, patientRecords: [] };
    }
    if (patients.length === 1) {
      // Don't auto-set activePatientId anymore — always confirm "you or family member?" first.
      return {
        patientRecord: patients[0],
        patientRecords: patients,
      };
    }
    return { patientRecord: null, patientRecords: patients };
  } catch (err) {
    console.error("[identifyPatientNode] Lookup failed:", err.message);
    return { patientRecord: null, patientRecords: [] };
  }
};

module.exports = { identifyPatientNode };