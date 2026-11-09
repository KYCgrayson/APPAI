# Leaderboard nickname vocabulary

`nickname-blocklist.ts` is an original, modest editorial list written for APPAI
in English, Traditional/Simplified Chinese, and Japanese. Sources are the common
words themselves and the owner-approved #68 nickname requirements; no external
profanity dataset, package, or licensed list was copied. The vocabulary and exact
name allowlist are released under CC0-1.0. This is a basic child-safety filter,
not a comprehensive language classifier; distinct-account reports hide a score
pending the phase 2 moderation workflow.

`nickname-casefold.ts` contains Unicode default case-fold exceptions generated
from Python's standard `str.casefold()` Unicode data (Unicode 13.0.0), under the
Unicode License v3 (Unicode-3.0):
https://www.unicode.org/license.txt . Algorithmic data only; no third-party word
list is included.

Unicode copyright and permission notice (Unicode License v3, Unicode-3.0):

Copyright © 1991-2026 Unicode, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
data files and any associated documentation (the "Data Files") or software and
any associated documentation (the "Software") to deal in the Data Files or
Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, and/or sell copies of the Data Files
or Software, and to permit persons to whom the Data Files or Software are
furnished to do so, provided that either (a) this copyright and permission
notice appear with all copies of the Data Files or Software, or (b) this
copyright and permission notice appear in associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF THIRD
PARTY RIGHTS. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN
THIS NOTICE BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL
DAMAGES, OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING
OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall not be
used in advertising or otherwise to promote the sale, use or other dealings in
these Data Files or Software without prior written authorization of the
copyright holder.
