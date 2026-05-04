/**
 * 集成测试：验证 session.prompt 的 format 字段 + structured output 响应结构
 *
 * 运行方式（需要先配置好 provider API key）：
 *   cd .opencode && npx bun run tests/structured-output.test.ts
 *
 * 验证项：
 * 1. session.prompt 是否接受 format: { type: "json_schema", schema: ... }
 * 2. 响应中 structured output 的字段名是 `structured` 还是 `structured_output`
 * 3. 返回值是否符合 schema 约束
 */

import { createOpencode } from "@opencode-ai/sdk"

async function main() {
  console.log("Starting opencode server...")
  const opencode = await createOpencode({ timeout: 15000 })
  const { client } = opencode

  try {
    // 创建测试 session
    const session = await client.session.create({
      body: { title: "test-structured-output" },
    })
    if (!session.data) {
      throw new Error(`Failed to create session: ${JSON.stringify(session.error)}`)
    }
    const sessionID = session.data.id
    console.log(`Session created: ${sessionID}`)

    // 发送带 format 的 prompt
    const result = await client.session.prompt({
      path: { id: sessionID },
      body: {
        parts: [
          {
            type: "text",
            text: 'Classify this task: "Add a login page". Return the category.',
          },
        ],
        // @ts-expect-error -- format exists at runtime but not in v1 SDK types
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["feature", "bugfix", "skill-creation"],
              },
            },
            required: ["category"],
          },
        },
      },
    })

    console.log("\n=== Response ===")
    console.log("result.data keys:", Object.keys(result.data ?? {}))
    console.log("result.data.info keys:", Object.keys((result.data as Record<string, unknown>)?.info ?? {}))

    const info = (result.data as Record<string, unknown>)?.info as Record<string, unknown> | undefined

    // 检查两个可能的字段名
    console.log("\n=== Structured Output Field Check ===")
    console.log('info.structured:', JSON.stringify(info?.structured))
    console.log('info.structured_output:', JSON.stringify(info?.["structured_output"]))

    // 判断哪个字段有值
    const structured = info?.structured ?? info?.["structured_output"]
    if (structured) {
      console.log("\n=== Parsed Structured Output ===")
      console.log(JSON.stringify(structured, null, 2))

      // 验证 schema 约束
      const output = structured as { category?: string }
      if (["feature", "bugfix", "skill-creation"].includes(output.category ?? "")) {
        console.log(`\nPASS: category = "${output.category}"`)
      } else {
        console.log(`\nFAIL: unexpected category = "${output.category}"`)
      }
    } else {
      console.log("\nFAIL: no structured output found in response")
      console.log("Full info:", JSON.stringify(info, null, 2))
    }

    // 清理
    await client.session.delete({ path: { id: sessionID } })
  } finally {
    opencode.server.close()
    console.log("\nServer closed.")
  }
}

main().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
