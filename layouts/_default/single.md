---
title: "{{ .Title }}"
date: {{ .Date.Format "2006-01-02" }}
{{- with .Params.tags }}
tags: {{ jsonify . }}
{{- end }}
---

{{ .RawContent }}
