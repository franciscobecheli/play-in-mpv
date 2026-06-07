#!/usr/bin/env python3
"""
Unit tests for host.py verifying Windows/Unix compatibility.
"""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure the host directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from host import host
except ImportError:
    import host


class TestHost(unittest.TestCase):
    @patch('sys.platform', 'win32')
    @patch('os.path.isfile')
    @patch('os.access')
    def test_is_executable_windows(self, mock_access, mock_isfile):
        mock_isfile.return_value = True
        self.assertTrue(host.is_executable('C:\\some\\path\\mpv.exe'))
        mock_access.assert_not_called()

        mock_isfile.return_value = False
        self.assertFalse(host.is_executable('C:\\some\\path\\mpv.exe'))

    @patch('sys.platform', 'linux')
    @patch('os.path.isfile')
    @patch('os.access')
    def test_is_executable_unix(self, mock_access, mock_isfile):
        mock_isfile.return_value = True
        mock_access.return_value = True
        self.assertTrue(host.is_executable('/usr/bin/mpv'))
        mock_access.assert_called_with('/usr/bin/mpv', os.X_OK)

        mock_access.return_value = False
        self.assertFalse(host.is_executable('/usr/bin/mpv'))

    @patch('sys.platform', 'win32')
    @patch('shutil.which')
    @patch('os.path.isfile')
    @patch('os.environ.get')
    def test_find_mpv_windows_in_path(self, mock_env, mock_isfile, mock_which):
        mock_which.return_value = 'C:\\ProgramData\\chocolatey\\bin\\mpv.exe'
        self.assertEqual(host.find_mpv(), 'C:\\ProgramData\\chocolatey\\bin\\mpv.exe')
        mock_which.assert_called_with('mpv')

    @patch('sys.platform', 'win32')
    @patch('shutil.which')
    @patch('os.path.isfile')
    def test_find_mpv_windows_common_paths(self, mock_isfile, mock_which):
        mock_which.return_value = None
        
        # Mock folder files. Assume C:\mpv\mpv.exe exists
        def isfile_side_effect(path):
            return path == 'C:\\mpv\\mpv.exe'
        mock_isfile.side_effect = isfile_side_effect
        
        self.assertEqual(host.find_mpv(), 'C:\\mpv\\mpv.exe')

    @patch('sys.platform', 'linux')
    @patch('os.path.isfile')
    @patch('os.access')
    def test_find_mpv_unix(self, mock_access, mock_isfile):
        mock_isfile.return_value = True
        mock_access.return_value = True
        self.assertEqual(host.find_mpv(), '/usr/bin/mpv')

    @patch('sys.platform', 'win32')
    @patch('shutil.which')
    @patch('os.path.isfile')
    def test_check_mpv_found_windows(self, mock_isfile, mock_which):
        # Mpv is custom path
        mock_isfile.return_value = True
        self.assertTrue(host.check_mpv_found('C:\\mpv\\mpv.exe'))

        # Not containing mpv
        mock_which.return_value = 'C:\\mpv\\mpv.exe'
        self.assertTrue(host.check_mpv_found('C:\\bin\\other.exe'))

    @patch('subprocess.Popen')
    @patch('sys.platform', 'win32')
    def test_launch_mpv_windows_creation_flags(self, mock_popen):
        host.launch_mpv('https://youtube.com/watch?v=123', mpv_path='mpv', flags=['--some-flag'])
        mock_popen.assert_called_once()
        kwargs = mock_popen.call_args[1]
        self.assertEqual(kwargs['creationflags'], 0x00000208)
        self.assertNotIn('start_new_session', kwargs)

    @patch('subprocess.Popen')
    @patch('sys.platform', 'linux')
    def test_launch_mpv_unix_session(self, mock_popen):
        host.launch_mpv('https://youtube.com/watch?v=123', mpv_path='mpv', flags=['--some-flag'])
        mock_popen.assert_called_once()
        kwargs = mock_popen.call_args[1]
        self.assertTrue(kwargs['start_new_session'])
        self.assertNotIn('creationflags', kwargs)


if __name__ == '__main__':
    unittest.main()
