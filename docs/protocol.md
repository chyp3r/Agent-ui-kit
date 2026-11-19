# Event protocol

One run is a sequence of events. Over NDJSON that is one JSON object per line; over SSE the `data:` is the
JSON (an `event:` name is accepted as the `type`).

```jsonc
{"type":"run.start"}
{"type":"step.start","node":"planner","details":"Analysing the question."}
{"type":"step.end","node":"planner","details":"…","output":{
   "plan":[{"agent":"researcher","instruction":"Collect the data."}],
   "data":{"category":"listing"}}}
{"type":"step.start","node":"researcher"}
{"type":"tool.start","callId":"c1","tool":"search","args":{"query":"last 30 days"}}
{"type":"tool.end","callId":"c1","summary":"8 records","records":[{"tag":"wiki","time":"01/10 09:00","text":"…"}]}
{"type":"step.end","node":"researcher"}
{"type":"reasoning.delta","text":"The question has two parts…"}
{"type":"approval.request","id":"send-mail","title":"Send the email?","payload":{"to":"team@example.com"}}
{"type":"approval.resolved","id":"send-mail","decision":"approved"}
{"type":"text.delta","text":"Eight "}
{"type":"final","text":"Eight records…","meta":{"category":"listing","verified":true,"confidence":0.93,
   "sources":[{"id":"s1","tag":"wiki","time":null,"agent":"researcher","confidence":0.9,"text":"…"}],
   "chart":null}}
```

| Event | Meaning |
|---|---|
| `step.start` / `step.end` | A node began / returned. `loop` counts passes; `title` names a node the kit does not know |
| `tool.start` / `tool.end` | A tool call, by `callId`. Optional: without them the map infers one call per step |
| `step.end.output` | `calls[]` (tool, args, `input` + `inputLanguage`, `output` + `outputKind`, records), `plan[]`, `verdict` (`passed`, `confidence`, `critique`, `missing`), `notes[]`, `data` (shown raw) |
| `text.delta` | A piece of the answer. `final.text` is the whole answer and wins |
| `reasoning.delta` | The model's own reasoning, shown in a fold |
| `approval.request` | The run waits on a person. The UI posts the decision through `adapter.respond(id, decision)`; the backend then emits `approval.resolved` and goes on |
| `final` | The answer and `meta` (category, verified, confidence, sources, chart) |
| `error` | The run failed. `status` ≥ 500 reads as "the agent failed", other statuses as "rejected" |

Unknown lines and unknown types are skipped, never fatal: one bad line must not cost the reader the answer
behind it. A stream that closes without `final` is a dropped connection.

`outputKind` is `text`, `markdown`, `table` (markdown), `code`, `json`, or a kind you register a renderer for.
