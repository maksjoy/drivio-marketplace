# HEIC decoder

CSP build of heic-to 1.5.2, loaded only when native decoding fails.
Source: https://github.com/hoppergee/heic-to (package version 1.5.2).
Package: https://registry.npmjs.org/heic-to/-/heic-to-1.5.2.tgz
License: LGPL-3.0, included in heic-to-LICENSE.txt. The npm package includes the corresponding JavaScript and libheif sources.

Local adaptation: a `const URL = window.URL` prefix avoids the existing application global named URL shadowing the browser API. Decoder logic is unchanged.

SHA-256 of heic-to-1.5.2.js: 166291840c44c97630222222128b545a708ddf5494c79b4d4174dde5c9189851
