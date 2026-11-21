package config

import (
	"bytes"
	"log"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadDefaultInterfaceMode(t *testing.T) {
	require.Equal(t, InterfaceModeFull, Load().DefaultInterfaceMode)

	t.Setenv("OPENPOST_DEFAULT_INTERFACE_MODE", "Simple")
	require.Equal(t, InterfaceModeSimple, Load().DefaultInterfaceMode)

	var output bytes.Buffer
	previousOutput := log.Writer()
	log.SetOutput(&output)
	t.Cleanup(func() { log.SetOutput(previousOutput) })
	t.Setenv("OPENPOST_DEFAULT_INTERFACE_MODE", "basic")
	require.Equal(t, InterfaceModeFull, Load().DefaultInterfaceMode)
	require.Contains(t, output.String(), `WARNING: invalid value for OPENPOST_DEFAULT_INTERFACE_MODE="basic"`)
}

func TestManagedDefaultInterfaceMode(t *testing.T) {
	cfg := &Config{}
	require.NoError(t, cfg.ApplyManagedValue("OPENPOST_DEFAULT_INTERFACE_MODE", "SIMPLE"))
	require.Equal(t, InterfaceModeSimple, cfg.DefaultInterfaceMode)
	require.ErrorContains(t, cfg.ApplyManagedValue("OPENPOST_DEFAULT_INTERFACE_MODE", ""), "must be one of the supported values")
}
