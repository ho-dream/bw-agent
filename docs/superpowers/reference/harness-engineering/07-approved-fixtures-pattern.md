# Approved Fixtures Pattern (Approved Scenarios)

> **Source:** <https://lexler.github.io/augmented-coding-patterns/patterns/approved-scenarios/>
> **Author / Documented by:** Ivett Ördög
> **Tags:** augmented coding patterns, testing, AI-generated code, approval testing

---

## Problem

Generating both tests and code with AI and not checking is risky. But AI is prone to generating lots of tests quickly. Reviewing many AI-generated tests quickly becomes impractical, especially when assertions are complex.

---

## Pattern

Design tests around **approval files** that combine input and expected output in a **domain-specific, easy-to-validate format**. This is a special case of the Constrained Tests pattern.

**Validate the test execution logic once.** After that, adding new test cases only requires reviewing fixtures.

Structure each approval file to contain:
- **Input data** (context, parameters, state)
- **Expected output** (results, side effects, API calls)
- **Format** adapted to the problem domain for easy scanning

The test runner reads fixtures, executes code, and regenerates approval files. **Validation becomes a simple diff review.**

This pattern works best for problems with an intuitive visual representation that is straightforward to check, but can also be used for checking call sequences.

---

## Examples

### Testing a Multi-Step Process with External Service Calls

Fixture file: `checkout-with-discount.approved.md`

```markdown
## Input
User: premium_member
Cart: [{product_id: "laptop-123", quantity: 1}, {product_id: "mouse-456", quantity: 1}]
Discount code: SAVE20

## Service Calls
POST /inventory/reserve
  {"items": [{product_id: "laptop-123", quantity: 1}, {product_id: "mouse-456", quantity: 1}]}
Response: 200 {"reservation_id": "res_789"}

GET /pricing/calculate
  {"items": [...], "user": "premium_member"}
Response: 200 {"subtotal": 1250, "discount": 250, "total": 1000}

POST /payment/process
  {"amount": 1000, "reservation_id": "res_789"}
Response: 200 {"transaction_id": "txn_abc"}

## Output
Order: confirmed
Total: $1000
Email sent: order_confirmation
```

A single test reads all `.approved.md` files, executes flows, regenerates files with actual results. Review is scanning markdown diffs, not reading assertion code.

### Testing Visual Algorithms

Fixture file: `game-of-life-glider.approved.md`

```markdown
## Input
......
..#...
...#..
.###..
......

## Result
......
......
.#.#..
..##..
..#...
```

Test reads all game-of-life fixtures, computes next generation, verifies output matches. Adding new test cases is drawing ASCII patterns — trivially easy to validate by eye.

### Testing Refactorings

Fixture pairs: `inline-variable.input.ts` + `inline-variable.approved.ts`

Input file:
```typescript
/**
 * @description Inline variable with multiple usages
 * @command refakts inline-variable "[{{CURRENT_FILE}} 8:18-8:21]"
 */

function processData(x: number, y: number): number {
    const sum = x + y;
    const result = sum * 2 + sum;
    return result;
}
```

Expected output file:
```typescript
/**
 * @description Inline variable with multiple usages
 * @command refakts inline-variable "[{{CURRENT_FILE}} 8:18-8:21]"
 */

function processData(x: number, y: number): number {
  const result = (x + y) * 2 + (x + y);
  return result;
}
```

The header contains the command that generates the approved output. Uses two separate files: one for input, one for expected output.

---

## Note

This pattern has similarities to Gherkin but better adapts to the specific domain, making the extra indirection worthwhile.

---

## Related Patterns

### Similar to
- **Check Alignment** — Verifying AI output aligns with expectations
- **Approved Logs** — Similar approval approach applied to log output

### Uses
- **Feedback Loop** — Fixtures create a feedback loop between AI generation and human review
- **Constrained Tests** — Approved Fixtures is a special case of constraining what tests can look like

### Solves
- **Hallucinations** — By separating test logic (validated once) from test data (reviewed as fixtures), you reduce the surface area for undetected hallucinations

---

## Why This Matters for Harness Engineering

Birgitta Böckeler's harness engineering article identifies the **behaviour harness** as the elephant in the room — how to verify functional correctness when AI generates both code and tests. The Approved Fixtures pattern is one of the few concrete answers:

- **Validate test execution logic once** (computational, deterministic)
- **Review only fixtures** (human judgment on domain-specific format)
- **The AI can generate new fixtures**, but a human can review them quickly because they're in an intuitive, domain-adapted format

This makes the pattern a bridge between computational and inferential verification — the test runner is computational, but the fixture review leverages human inferential judgment in a highly efficient way.
