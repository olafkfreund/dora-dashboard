{{- define "dora.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "dora.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "dora.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "dora.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "dora.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dora.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "dora.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "dora.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "dora.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- include "dora.fullname" . -}}
{{- end -}}
{{- end -}}

{{- define "dora.postgresName" -}}
{{- printf "%s-postgres" (include "dora.fullname" .) -}}
{{- end -}}

{{- define "dora.nextauthUrl" -}}
{{- if .Values.config.nextauthUrl -}}
{{- .Values.config.nextauthUrl -}}
{{- else -}}
{{- printf "https://%s" .Values.ingress.host -}}
{{- end -}}
{{- end -}}
