/**
 * AJV validator for AVM-1 value manifests, compiled from the canonical schema
 * (src/value-manifest.schema.json, synced from spec/value-manifest.schema.json).
 *
 * SPDX-License-Identifier: AGPL-3.0
 */
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import schema from './value-manifest.schema.json'

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)

export const validateManifestSchema = ajv.compile(schema)

/** Format AJV errors into readable `path: message` strings. */
export function schemaErrors(): string[] {
  const errs = validateManifestSchema.errors ?? []
  return errs.map((e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`.trim())
}
