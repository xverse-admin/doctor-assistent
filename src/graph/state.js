//src/graph/state.js
const { Annotation } = require("@langchain/langgraph");

const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  nextAgent: Annotation({
    reducer: (x, y) => y,
    default: () => "orchestrator",
  }),
  userPhone: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  patientRecord: Annotation({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => undefined, // undefined = not looked up yet, null = looked up, not found
  }),
  patientRecords: Annotation({
  reducer: (x, y) => (y !== undefined ? y : x),
  default: () => undefined, // undefined = not looked up yet
}),
activePatientId: Annotation({
  reducer: (x, y) => y ?? x,
  default: () => null,
}),
 appointmentData: Annotation({
  reducer: (x, y) => ({ ...x, ...y }),
  default: () => ({
    patientName: null,
    doctorName:  null,
    doctorId:    null,
    email:       null,
    date:        null,
    time:        null,
    age:         null,
    gender:      null,
    city:        null,
    conditions:  null,
    patientRegistered: false,
    bookingIntent: false,
  }),
}),
});

module.exports = { AgentState };