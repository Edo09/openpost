package config

import (
	"log"
	"strings"
)

// interfaceLocales mirrors the locales in apps/web/project.inlang/settings.json,
// in the same order, each labelled with its own name as the web language menu
// shows it. TestInterfaceLocalesMatchWebProject keeps the lists in step.
var interfaceLocales = []ManagedSettingOption{
	{Value: "en", Label: "English"},
	{Value: "es", Label: "Español"},
	{Value: "fr", Label: "Français"},
	{Value: "de", Label: "Deutsch"},
	{Value: "it", Label: "Italiano"},
	{Value: "ru", Label: "Русский"},
	{Value: "pt", Label: "Português"},
	{Value: "pt-BR", Label: "Português do Brasil"},
	{Value: "tr", Label: "Türkçe"},
	{Value: "ja", Label: "日本語"},
	{Value: "ko", Label: "한국어"},
	{Value: "zh", Label: "简体中文"},
}

// defaultLocaleOptions lists the choices for OPENPOST_DEFAULT_LOCALE. The
// empty value keeps the browser-language behavior.
func defaultLocaleOptions() []ManagedSettingOption {
	options := make([]ManagedSettingOption, 0, len(interfaceLocales)+1)
	options = append(options, ManagedSettingOption{Value: "", Label: "Browser language"})
	return append(options, interfaceLocales...)
}

// NormalizeInterfaceLocale returns the supported web interface locale for a
// language tag. It tries the whole tag without regard to case, then its base
// language, so es-ES selects es while pt-BR keeps its own locale.
func NormalizeInterfaceLocale(value string) (string, bool) {
	tag := strings.ReplaceAll(strings.TrimSpace(value), "_", "-")
	if locale, ok := matchInterfaceLocale(tag); ok {
		return locale, true
	}
	if base, _, found := strings.Cut(tag, "-"); found {
		return matchInterfaceLocale(base)
	}
	return "", false
}

func matchInterfaceLocale(tag string) (string, bool) {
	for _, locale := range interfaceLocales {
		if strings.EqualFold(locale.Value, tag) {
			return locale.Value, true
		}
	}
	return "", false
}

// getEnvLocale reads an optional interface locale. An unsupported value is
// ignored with a warning, like the other enumerated settings, so a typo
// leaves each browser on its own language instead of blocking startup.
func getEnvLocale(key string) string {
	value, source, ok := getEnvValue(key)
	if !ok || strings.TrimSpace(value) == "" {
		return ""
	}
	locale, supported := NormalizeInterfaceLocale(value)
	if !supported {
		log.Printf("WARNING: unsupported locale for %s=%q, using each browser's language", source, value)
		return ""
	}
	return locale
}
