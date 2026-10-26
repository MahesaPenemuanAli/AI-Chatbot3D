# HTTPS trust bundle

cacert.pem is the Mozilla CA bundle distributed by curl:
https://curl.se/docs/caextract.html

Source: https://curl.se/ca/cacert.pem
SHA256: 796f1389bfea13c0ed78f663b765baaff54a508e5483786bd6ece73c5e3e3cbe

It is used by the Gemini HTTP client so XAMPP installations without curl.cainfo can verify HTTPS certificates. Certificate verification remains enabled. Override services.gemini.ca_bundle with GEMINI_CA_BUNDLE when your environment supplies its own trusted CA bundle.

The converted certificate data is licensed under Mozilla Public License 2.0, as stated by curl.

