'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export type ClientJsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, ClientJsonSchema>;
  required?: string[];
  items?: ClientJsonSchema;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  anyOf?: ClientJsonSchema[];
  oneOf?: ClientJsonSchema[];
  allOf?: ClientJsonSchema[];
  [key: string]: unknown;
};

function normalizedKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function humanize(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function schemaType(schema: ClientJsonSchema) {
  const value = Array.isArray(schema.type) ? schema.type.find((type) => type !== 'null') : schema.type;
  if (value) return value;
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  return 'string';
}

function resolvedSchema(schema: ClientJsonSchema): ClientJsonSchema {
  const variant = schema.oneOf?.[0] || schema.anyOf?.[0];
  const base = variant ? { ...schema, ...variant, oneOf: undefined, anyOf: undefined } : { ...schema };
  if (!base.allOf?.length) return base;
  return base.allOf.reduce<ClientJsonSchema>((merged, child) => {
    const resolved = resolvedSchema(child);
    return {
      ...merged,
      ...resolved,
      properties: { ...(merged.properties || {}), ...(resolved.properties || {}) },
      required: Array.from(new Set([...(merged.required || []), ...(resolved.required || [])])),
      allOf: undefined,
    };
  }, { ...base, allOf: undefined });
}

function writePath(value: Record<string, unknown>, path: string[], next: unknown): Record<string, unknown> {
  const [head, ...tail] = path;
  if (!head) return value;
  if (!tail.length) {
    if (next === undefined || next === '') {
      const copy = { ...value };
      delete copy[head];
      return copy;
    }
    return { ...value, [head]: next };
  }
  const current = value[head];
  const child = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {};
  return { ...value, [head]: writePath(child, tail, next) };
}

function findCandidatePaths(schema: ClientJsonSchema, candidates: Set<string>, path: string[] = [], output: string[][] = []) {
  const resolved = resolvedSchema(schema);
  for (const [key, child] of Object.entries(resolved.properties || {})) {
    const next = [...path, key];
    if (candidates.has(normalizedKey(key))) output.push(next);
    if (schemaType(child) === 'object') findCandidatePaths(child, candidates, next, output);
  }
  return output;
}

export function setSchemaFieldByCandidates(
  current: Record<string, unknown>,
  schema: ClientJsonSchema | undefined,
  candidates: string[],
  value: unknown
) {
  if (!schema) return current;
  const paths = findCandidatePaths(schema, new Set(candidates.map(normalizedKey)));
  return paths.length === 1 ? writePath(current, paths[0], value) : current;
}

export function schemaDefaults(schema: ClientJsonSchema | undefined): Record<string, unknown> {
  if (!schema) return {};
  const resolved = resolvedSchema(schema);
  const result: Record<string, unknown> = {};
  for (const [key, childSchema] of Object.entries(resolved.properties || {})) {
    const child = resolvedSchema(childSchema);
    if (child.default !== undefined) result[key] = child.default;
    else if (schemaType(child) === 'object') {
      const nested = schemaDefaults(child);
      if (Object.keys(nested).length) result[key] = nested;
    }
  }
  return result;
}

export function missingRequiredFields(
  schema: ClientJsonSchema | undefined,
  value: Record<string, unknown>,
  hiddenKeys: Set<string>,
  prefix = ''
): string[] {
  if (!schema) return ['schema MCP'];
  const resolved = resolvedSchema(schema);
  const missing: string[] = [];
  for (const key of resolved.required || []) {
    if (hiddenKeys.has(normalizedKey(key))) continue;
    const child = value[key];
    if (child === undefined || child === null || child === '' || Array.isArray(child) && child.length === 0) {
      missing.push(`${prefix}${humanize(key)}`);
    }
  }
  for (const [key, childSchema] of Object.entries(resolved.properties || {})) {
    if (hiddenKeys.has(normalizedKey(key))) continue;
    const child = value[key];
    if (child && typeof child === 'object' && !Array.isArray(child) && schemaType(childSchema) === 'object') {
      missing.push(...missingRequiredFields(childSchema, child as Record<string, unknown>, hiddenKeys, `${prefix}${humanize(key)} · `));
    }
  }
  return missing;
}

function JsonValueField({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(() => value === undefined ? '' : JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (!text.trim()) {
      setError(null);
      onChange(undefined);
      return;
    }
    try {
      onChange(JSON.parse(text));
      setError(null);
    } catch {
      setError('JSON invalid');
    }
  }

  return (
    <div>
      <Textarea value={text} onChange={(event) => setText(event.target.value)} onBlur={commit} className="min-h-28 rounded-xl font-mono text-xs" />
      {error ? <p className="mt-1 flex items-center gap-1 text-xs text-rose-600"><AlertTriangle className="h-3 w-3" />{error}</p> : null}
    </div>
  );
}

function SchemaField({
  name,
  schema,
  value,
  required,
  hiddenKeys,
  onChange,
}: {
  name: string;
  schema: ClientJsonSchema;
  value: unknown;
  required: boolean;
  hiddenKeys: Set<string>;
  onChange: (value: unknown) => void;
}) {
  const resolved = useMemo(() => resolvedSchema(schema), [schema]);
  const type = schemaType(resolved);
  if (hiddenKeys.has(normalizedKey(name))) return null;

  if (type === 'object' && resolved.properties) {
    const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return (
      <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <legend className="px-2 text-sm font-bold text-slate-800">{resolved.title || humanize(name)}{required ? ' *' : ''}</legend>
        {resolved.description ? <p className="mb-3 text-xs leading-5 text-slate-500">{resolved.description}</p> : null}
        <SchemaObjectFields schema={resolved} value={record} hiddenKeys={hiddenKeys} onChange={(next) => onChange(next)} />
      </fieldset>
    );
  }

  const label = resolved.title || humanize(name);
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-slate-800">{label}{required ? ' *' : ''}</Label>
      {resolved.enum?.length ? (
        <Select value={value == null ? '' : String(value)} onValueChange={(next) => onChange(next)}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={`Selectează ${label.toLowerCase()}`} /></SelectTrigger>
          <SelectContent>
            {resolved.enum.filter((option): option is string | number => typeof option === 'string' || typeof option === 'number').map((option) => (
              <SelectItem key={String(option)} value={String(option)}>{humanize(String(option))}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === 'boolean' ? (
        <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
          <span className="text-sm text-slate-600">{value === true ? 'Activat' : 'Dezactivat'}</span>
          <Switch checked={value === true} onCheckedChange={onChange} />
        </div>
      ) : type === 'array' || type === 'object' ? (
        <JsonValueField key={JSON.stringify(value)} value={value} onChange={onChange} />
      ) : (
        <Input
          type={type === 'number' || type === 'integer' ? 'number' : 'text'}
          step={type === 'integer' ? 1 : type === 'number' ? 'any' : undefined}
          min={resolved.minimum}
          max={resolved.maximum}
          minLength={resolved.minLength}
          maxLength={resolved.maxLength}
          value={value == null ? '' : String(value)}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl"
          placeholder={resolved.description || label}
        />
      )}
      {resolved.description && type !== 'object' ? <p className="text-xs leading-5 text-slate-500">{resolved.description}</p> : null}
    </div>
  );
}

function SchemaObjectFields({
  schema,
  value,
  hiddenKeys,
  onChange,
}: {
  schema: ClientJsonSchema;
  value: Record<string, unknown>;
  hiddenKeys: Set<string>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const resolved = resolvedSchema(schema);
  const entries = Object.entries(resolved.properties || {}).filter(([key]) => !hiddenKeys.has(normalizedKey(key)));
  if (!entries.length) {
    return <JsonValueField key={JSON.stringify(value)} value={value} onChange={(next) => onChange(next && typeof next === 'object' && !Array.isArray(next) ? next as Record<string, unknown> : {})} />;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map(([key, child]) => (
        <SchemaField
          key={key}
          name={key}
          schema={child}
          value={value[key]}
          required={Boolean(resolved.required?.includes(key))}
          hiddenKeys={hiddenKeys}
          onChange={(next) => onChange(writePath(value, [key], next))}
        />
      ))}
    </div>
  );
}

export function TikTokSchemaForm({
  schema,
  value,
  hiddenKeys = [],
  onChange,
}: {
  schema?: ClientJsonSchema;
  value: Record<string, unknown>;
  hiddenKeys?: string[];
  onChange: (value: Record<string, unknown>) => void;
}) {
  const hidden = useMemo(() => new Set(hiddenKeys.map(normalizedKey)), [hiddenKeys]);
  if (!schema) {
    return <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">Schema MCP lipsește. Reîmprospătează capabilitățile după conectarea TikTok.</div>;
  }
  return <SchemaObjectFields schema={schema} value={value} hiddenKeys={hidden} onChange={onChange} />;
}
