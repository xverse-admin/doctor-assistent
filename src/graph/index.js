// src/graph/index.js
const { MemorySaver }       = require("@langchain/langgraph");
const { StateGraph, END }   = require("@langchain/langgraph");
const { ToolNode }          = require("@langchain/langgraph/prebuilt");
const { AgentState }        = require("./state");

const { orchestratorNode }   = require("../agents/orchestrator");
const { doctorNode }         = require("../agents/doctor");
const { availabilityNode }   = require("../agents/availability");
const { bookingNode }        = require("../agents/booking");
const { knowledgeBaseNode }  = require("../agents/knowledgeBase");

const { checkAvailabilityTool, bookAppointmentTool } = require("../tools/calendar");
const tools = [checkAvailabilityTool, bookAppointmentTool];

const memory = new MemorySaver();

// ── Build graph ───────────────────────────────────────────────────────────────
const workflow = new StateGraph(AgentState);

// Register all nodes
workflow.addNode("orchestrator",     orchestratorNode);
workflow.addNode("doctor_assistant", doctorNode);
workflow.addNode("check_availability", availabilityNode);
workflow.addNode("booking_agent",    bookingNode);
workflow.addNode("knowledge_query",  knowledgeBaseNode);
workflow.addNode("tools",            new ToolNode(tools));

// Entry
workflow.addEdge("__start__", "orchestrator");

// Orchestrator → correct agent
workflow.addConditionalEdges(
  "orchestrator",
  (state) => state.nextAgent,
  {
    doctor_assistant:   "doctor_assistant",
    check_availability: "check_availability",
    booking_agent:      "booking_agent",
    knowledge_query:    "knowledge_query",
  }
);

// Doctor assistant → tool call OR end
workflow.addConditionalEdges(
  "doctor_assistant",
  (state) => {
    const last = state.messages[state.messages.length - 1];
    return last?.tool_calls?.length > 0 ? "tools" : END;
  },
  { tools: "tools", [END]: END }
);

// Availability → tool call OR end
workflow.addConditionalEdges(
  "check_availability",
  (state) => {
    const last = state.messages[state.messages.length - 1];
    return last?.tool_calls?.length > 0 ? "tools" : END;
  },
  { tools: "tools", [END]: END }
);

// Booking → tool call OR end
workflow.addConditionalEdges(
  "booking_agent",
  (state) => {
    const last = state.messages[state.messages.length - 1];
    return last?.tool_calls?.length > 0 ? "tools" : END;
  },
  { tools: "tools", [END]: END }
);

// Tools → back to doctor (handles tool results)
workflow.addEdge("tools", "doctor_assistant");

// Knowledge query → always ends immediately after answering
workflow.addEdge("knowledge_query", END);

// Compile with memory
const graph = workflow.compile({ checkpointer: memory });

module.exports = { graph, memory };
