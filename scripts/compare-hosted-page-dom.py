#!/usr/bin/env python3
"""Compare fictional production HTML captures; preserve publisher text and JSON-LD."""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class DOM(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens = []
        self.skipped = None
        self.schema = None
        self.schemas = []
        self.lang = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html':
            self.lang = attrs.get('lang')
        if tag == 'script':
            if attrs.get('type') == 'application/ld+json':
                self.schema = ''
            else:
                self.skipped = tag
            return
        if tag == 'link' and (attrs.get('href', '').startswith('/_next/') or attrs.get('rel') == 'preload' and attrs.get('as') == 'script'):
            return  # build-specific executable/CSS resource URL, not publisher DOM
        if self.skipped:
            return
        if tag == 'input' and attrs.get('type') == 'hidden' and attrs.get('name', '').startswith('$ACTION_'):
            return  # generated encrypted server-action transport varies by build
        normalized = []
        for key, value in sorted(attrs.items()):
            if value:
                value = re.sub(r'appai_session=[^&"\s]+', 'appai_session=FIXTURE_TOKEN', value)
                value = re.sub(r'\$ACTION_ID_[a-f0-9]+', '$ACTION_ID_BUILD', value)
            normalized.append((key, value))
        self.tokens.append(('start', tag, normalized))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == self.skipped:
            self.skipped = None
            return
        if tag == 'script' and self.schema is not None:
            schema = json.loads(self.schema)
            self.schemas.append(schema)
            self.tokens.append(('jsonld', schema))
            self.schema = None
            return
        if not self.skipped:
            self.tokens.append(('end', tag))

    def handle_data(self, data):
        if self.schema is not None:
            self.schema += data
        elif not self.skipped:
            self.tokens.append(('text', data))


def compare(before, after):
    results = []
    for name in ['person', 'root', 'locale', 'zh-fallback', 'inline-tool', 'fullscreen-tool', 'child', 'privacy', 'terms', 'login-gate']:
        old, new = DOM(), DOM()
        old.feed((before / f'{name}.html').read_text())
        new.feed((after / f'{name}.html').read_text())
        if old.tokens != new.tokens:
            for i, (left, right) in enumerate(zip(old.tokens, new.tokens)):
                if left != right:
                    raise AssertionError(f'{name} token {i}: {left!r} != {right!r}')
            raise AssertionError(f'{name} length: {len(old.tokens)} != {len(new.tokens)}')
        assert old.schemas == new.schemas and old.schemas, name
        assert old.lang == new.lang and new.lang, name
        results.append({'case': name, 'tokens': len(new.tokens), 'jsonLdBlocks': len(new.schemas), 'lang': new.lang, 'identical': True})
    return results


if __name__ == '__main__':
    print(json.dumps(compare(Path(sys.argv[1]), Path(sys.argv[2])), ensure_ascii=False, indent=2))
