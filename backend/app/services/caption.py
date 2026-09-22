import re

# frontend/src/utils/parseCaption.js 의 `([#@])([\p{L}\p{N}_.]{1,50})` 와 동일한 규칙.
# Python 표준 re는 \p{L}/\p{N}을 지원하지 않지만, str 패턴에서 \w는 기본적으로
# 유니코드 문자/숫자/밑줄을 포함하므로 [\w.] 로 사실상 동일하게 매칭된다.
_TOKEN_RE = re.compile(r"([#@])([\w.]{1,50})", re.UNICODE)


def extract_hashtags(text: str) -> set[str]:
    if not text:
        return set()
    return {m.group(2).lower() for m in _TOKEN_RE.finditer(text) if m.group(1) == "#"}


def extract_mentions(text: str) -> set[str]:
    if not text:
        return set()
    return {m.group(2).lower() for m in _TOKEN_RE.finditer(text) if m.group(1) == "@"}
