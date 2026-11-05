package config

import (
	"bytes"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInterfaceLocalesMatchWebProject(t *testing.T) {
	data, err := os.ReadFile("../../../web/project.inlang/settings.json")
	require.NoError(t, err)
	var project struct {
		Locales []string `json:"locales"`
	}
	require.NoError(t, json.Unmarshal(data, &project))

	values := make([]string, 0, len(interfaceLocales))
	for _, locale := range interfaceLocales {
		require.NotEmpty(t, locale.Label, locale.Value)
		values = append(values, locale.Value)
	}
	require.Equal(t, project.Locales, values)
}

func TestNormalizeInterfaceLocale(t *testing.T) {
	for value, want := range map[string]string{
		"es":         "es",
		" PT-br ":    "pt-BR",
		"pt_BR":      "pt-BR",
		"es-ES":      "es",
		"zh-Hans-CN": "zh",
	} {
		got, ok := NormalizeInterfaceLocale(value)
		require.True(t, ok, value)
		require.Equal(t, want, got, value)
	}
	for _, value := range []string{"", "-es", "xx", "klingon"} {
		_, ok := NormalizeInterfaceLocale(value)
		require.False(t, ok, value)
	}
}

func TestLoadDefaultLocale(t *testing.T) {
	require.Empty(t, Load().DefaultLocale)

	t.Setenv("OPENPOST_DEFAULT_LOCALE", "ES")
	require.Equal(t, "es", Load().DefaultLocale)

	t.Setenv("OPENPOST_DEFAULT_LOCALE", "")
	path := filepath.Join(t.TempDir(), "default-locale")
	require.NoError(t, os.WriteFile(path, []byte("pt-BR\n"), 0o600))
	t.Setenv("OPENPOST_DEFAULT_LOCALE_FILE", path)
	require.Equal(t, "pt-BR", Load().DefaultLocale)
}

func TestLoadIgnoresUnsupportedDefaultLocale(t *testing.T) {
	var output bytes.Buffer
	previousOutput := log.Writer()
	log.SetOutput(&output)
	t.Cleanup(func() { log.SetOutput(previousOutput) })

	t.Setenv("OPENPOST_DEFAULT_LOCALE", "klingon")

	require.Empty(t, Load().DefaultLocale)
	require.Contains(t, output.String(), `WARNING: unsupported locale for OPENPOST_DEFAULT_LOCALE="klingon"`)
}

func TestManagedDefaultLocaleKeepsCanonicalSpelling(t *testing.T) {
	definition, ok := ManagedSettingDefinitionFor("OPENPOST_DEFAULT_LOCALE")
	require.True(t, ok)
	require.Equal(t, ManagedSettingOption{Value: "", Label: "Browser language"}, definition.Options[0])
	require.Equal(t, interfaceLocales, definition.Options[1:])

	cfg := &Config{}
	require.NoError(t, cfg.ApplyManagedValue("OPENPOST_DEFAULT_LOCALE", "PT-BR"))
	require.Equal(t, "pt-BR", cfg.DefaultLocale)
	require.NoError(t, cfg.ApplyManagedValue("OPENPOST_DEFAULT_LOCALE", " "))
	require.Empty(t, cfg.DefaultLocale)
	require.ErrorContains(t, cfg.ApplyManagedValue("OPENPOST_DEFAULT_LOCALE", "klingon"), "must be one of the supported values")
}
