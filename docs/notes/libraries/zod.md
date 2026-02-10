# Zod

**Version:** 4.3.6
**Source:** https://github.com/colinhacks/zod
**Docs:** https://zod.dev/api

## Overview

TypeScript-first schema validation with static type inference. Define a schema, parse data, get back strongly typed, validated results. Zero external dependencies.

## Key Features

- **Zero dependencies:** Tiny 2kb core bundle (gzipped)
- **Immutable API:** Methods return new instances
- **Type inference:** `z.infer<typeof schema>` extracts TypeScript types
- **Works in Node.js and browsers**
- **Built-in JSON Schema conversion**

## Basic Usage

### Define Schema

```typescript
import * as z from "zod"

const Player = z.object({
  username: z.string(),
  xp: z.number(),
})
```

### Parse Data

```typescript
// Throws ZodError on failure
const data = Player.parse({ username: "billie", xp: 100 })

// Returns discriminated union (no throw)
const result = Player.safeParse(input)
if (!result.success) {
  console.log(result.error) // ZodError instance
} else {
  console.log(result.data) // { username: string; xp: number }
}
```

### Async Validation

```typescript
const schema = z.string().refine(async (val) => val.length <= 8)
await schema.parseAsync("hello")
```

### Infer Types

```typescript
type Player = z.infer<typeof Player>
// Equivalent to: { username: string; xp: number }

// For transforms where input ≠ output:
type Input = z.input<typeof schema>
type Output = z.output<typeof schema> // same as z.infer
```

## Error Handling

```typescript
try {
  Player.parse({ username: 42, xp: "100" })
} catch (err) {
  if (err instanceof z.ZodError) {
    err.issues // Array of detailed validation errors
    // [{ expected: 'string', code: 'invalid_type', path: ['username'], message: '...' }]
  }
}
```

## Common Patterns

### Optional Fields

```typescript
z.object({
  name: z.string(),
  email: z.string().optional(), // string | undefined
})
```

### Default Values

```typescript
z.object({
  role: z.string().default("crewmate"),
})
```

### Enums

```typescript
const Role = z.enum(["crewmate", "impostor", "ghost"])
type Role = z.infer<typeof Role> // "crewmate" | "impostor" | "ghost"
```

### Refinements

```typescript
z.string().refine((s) => s.length >= 3, {
  message: "Must be at least 3 characters",
})
```

## In among-us-ai

Used for validating API inputs, game state transitions, WebSocket messages, and configuration objects. Provides type safety and runtime validation.
