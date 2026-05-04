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
  // Update this section to include all user details you want to capture
  appointmentData: Annotation({
    reducer: (x, y) => ({ ...x, ...y }), // This merges new data into existing data
    default: () => ({
      name: null,       
      //phone: null,      
      email: null,
      date: null,
      time: null,
      //reason: null,
    }),
  }),
});

module.exports = { AgentState };