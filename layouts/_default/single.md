---
title: "{{ .Title }}"
canonical: "{{ .Permalink }}"
{{- with .Description }}
description: {{ . | jsonify }}
{{- end }}
{{- if eq .Section "posts" }}
date: {{ .Date.Format "2006-01-02" }}
lastmod: {{ .Lastmod.Format "2006-01-02" }}
{{- with .Params.tags }}
tags: {{ jsonify . }}
{{- end }}
{{- end }}
---

{{ .RawContent }}
