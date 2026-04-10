import { NextRequest, NextResponse } from "next/server";
import {
  SECTION_DEFS,
  COMMON_SECTION_FIELD,
  type SectionFieldDef,
} from "@/lib/template-registry";

type JsonSchema = {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
};

/** Convert our internal SectionFieldDef to a standard JSON Schema object. */
function fieldToJsonSchema(field: SectionFieldDef): JsonSchema {
  const base: JsonSchema = { type: "string" };
  switch (field.type) {
    case "string":
    case "url":
    case "markdown":
      base.type = "string";
      if (field.type === "url") base.description = `(URL) ${field.description}`;
      else if (field.type === "markdown") base.description = `(Markdown) ${field.description}`;
      else base.description = field.description;
      break;
    case "boolean":
      base.type = "boolean";
      base.description = field.description;
      break;
    case "number":
      base.type = "number";
      base.description = field.description;
      break;
    case "array":
      base.type = "array";
      base.description = field.description;
      if (field.items && field.items.length > 0) {
        const props: Record<string, JsonSchema> = {};
        const req: string[] = [];
        for (const item of field.items) {
          props[item.name] = fieldToJsonSchema(item);
          if (item.required) req.push(item.name);
        }
        base.items = { type: "object", properties: props, ...(req.length > 0 ? { required: req } : {}) };
      }
      break;
    case "object":
      base.type = "object";
      base.description = field.description;
      if (field.fields && field.fields.length > 0) {
        const props: Record<string, JsonSchema> = {};
        const req: string[] = [];
        for (const sub of field.fields) {
          props[sub.name] = fieldToJsonSchema(sub);
          if (sub.required) req.push(sub.name);
        }
        base.properties = props;
        if (req.length > 0) base.required = req;
      }
      break;
  }
  return base;
}

// GET /api/v1/sections
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");

  // Inject the common `id` field into every section's field list so agents
  // see it in the spec without us having to duplicate it in SECTION_DEFS.
  const enriched = SECTION_DEFS.map((s) => ({
    ...s,
    fields: [COMMON_SECTION_FIELD, ...s.fields],
  }));

  if (format === "jsonschema") {
    const schemas: Record<string, JsonSchema> = {};
    for (const s of enriched) {
      const props: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const f of s.fields) {
        props[f.name] = fieldToJsonSchema(f);
        if (f.required) required.push(f.name);
      }
      schemas[s.type] = {
        type: "object",
        description: s.description,
        properties: props,
        ...(required.length > 0 ? { required } : {}),
      };
    }
    return NextResponse.json({ $schema: "https://json-schema.org/draft/2020-12/schema", sections: schemas });
  }

  return NextResponse.json({
    sections: enriched,
    total: enriched.length,
  });
}
