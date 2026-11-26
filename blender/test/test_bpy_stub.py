# SPDX-License-Identifier: GPL-3.0-or-later
"""
Unit tests for Blender bridge Python modules using a lightweight bpy stub.
Runs without requiring a local Blender executable installation.
"""

import sys
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock

# Ensure blender directory is in Python module search path
blender_dir = Path(__file__).resolve().parent.parent
if str(blender_dir) not in sys.path:
    sys.path.insert(0, str(blender_dir))


class BpyStubFactory:
    """Creates a mock bpy module and injects it into sys.modules."""

    @staticmethod
    def create_and_install():
        mock_bpy = ModuleType("bpy")
        mock_bpy.app = MagicMock()
        mock_bpy.app.version = (4, 2, 0)
        mock_bpy.app.version_string = "4.2.0"

        # Mock types
        mock_bpy.types = MagicMock()
        engine_prop = MagicMock()
        item1 = MagicMock()
        item1.identifier = "BLENDER_EEVEE_NEXT"
        item2 = MagicMock()
        item2.identifier = "CYCLES"
        engine_prop.enum_items = [item1, item2]

        mock_bpy.types.RenderSettings.bl_rna.properties = {"engine": engine_prop}

        # Mock data and context
        mock_bpy.data = MagicMock()
        mock_bpy.context = MagicMock()
        mock_bpy.ops = MagicMock()

        sys.modules["bpy"] = mock_bpy
        return mock_bpy


# Install mock bpy before importing blender modules
mock_bpy = BpyStubFactory.create_and_install()

# Import compat module
import compat


class TestBlenderCompatLayer(unittest.TestCase):
    def setUp(self):
        mock_bpy.app.version = (4, 2, 0)
        mock_bpy.app.version_string = "4.2.0"

    def test_version_check_passes_for_supported_versions(self):
        mock_bpy.app.version = (4, 2, 0)
        info = compat.check_version(min_version=(4, 2, 0))
        self.assertEqual(info["major"], 4)
        self.assertEqual(info["minor"], 2)

    def test_version_check_passes_for_blender_5(self):
        mock_bpy.app.version = (5, 0, 0)
        mock_bpy.app.version_string = "5.0.0"
        info = compat.check_version(min_version=(4, 2, 0))
        self.assertEqual(info["major"], 5)

    def test_version_check_fails_for_outdated_versions(self):
        mock_bpy.app.version = (3, 6, 0)
        mock_bpy.app.version_string = "3.6.0"
        with self.assertRaises(RuntimeError) as ctx:
            compat.check_version(min_version=(4, 2, 0))
        self.assertIn("below minimum supported version", str(ctx.exception))

    def test_eevee_engine_identifier_detection(self):
        engine_id = compat.get_eevee_engine_id()
        self.assertIn(engine_id, ["BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"])

    def test_principled_bsdf_socket_fallback(self):
        node = MagicMock()
        socket_base_color = MagicMock()
        socket_base_color.name = "Base Color"
        node.inputs = {"Base Color": socket_base_color}

        sock = compat.get_principled_bsdf_socket(node, "Base Color")
        self.assertIsNotNone(sock)
        self.assertEqual(sock.name, "Base Color")

    def test_principled_bsdf_socket_fallback_alias(self):
        node = MagicMock()
        socket_color = MagicMock()
        socket_color.name = "Color"
        node.inputs = {"Color": socket_color}

        # Querying "Base Color" should resolve alias "Color" via SOCKET_FALLBACKS
        sock = compat.get_principled_bsdf_socket(node, "Base Color")
        self.assertIsNotNone(sock)
        self.assertEqual(sock.name, "Color")


if __name__ == "__main__":
    unittest.main()
