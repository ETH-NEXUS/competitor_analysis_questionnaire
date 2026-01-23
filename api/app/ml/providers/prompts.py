THINKING_PROMPT_JSON = (
    "Respond in JSON with keys: thinking (string or null) and content (string). "
    "If you include reasoning, put it in thinking. Do not include extra keys."
)

THINKING_PROMPT_TAGS = (
    "When you respond, first output a line that is exactly: Thinking... "
    "Then write your reasoning. When finished, output a line that is exactly: Done thinking "
    "After that, output the final answer only. Do not include other labels."
)
