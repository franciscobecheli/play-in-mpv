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
    def test_find_mpv_windows_in_path(self, mock_which):
        mock_which.return_value = 'C:\\ProgramData\\chocolatey\\bin\\mpv.exe'
        self.assertEqual(host.find_mpv(), 'C:\\ProgramData\\chocolatey\\bin\\mpv.exe')
        mock_which.assert_called_with('mpv')

    @patch('sys.platform', 'win32')
    @patch('shutil.which')
    def test_find_mpv_windows_not_found(self, mock_which):
        mock_which.return_value = None
        self.assertEqual(host.find_mpv(), 'mpv')

    @patch('sys.platform', 'linux')
    @patch('shutil.which')
    def test_find_mpv_unix(self, mock_which):
        mock_which.return_value = '/usr/bin/mpv'
        self.assertEqual(host.find_mpv(), '/usr/bin/mpv')
        mock_which.assert_called_with('mpv')

    @patch('sys.platform', 'win32')
    @patch('shutil.which')
    @patch('host.is_executable')
    def test_check_mpv_found_windows(self, mock_is_executable, mock_which):
        # Mpv is custom path
        mock_is_executable.return_value = True
        self.assertTrue(host.check_mpv_found('C:\\mpv\\mpv.exe'))
        mock_is_executable.assert_called_with('C:\\mpv\\mpv.exe')

        # No path provided, falls back to PATH lookup
        mock_which.return_value = 'C:\\Program Files\\mpv\\mpv.exe'
        self.assertTrue(host.check_mpv_found(None))
        mock_which.assert_called_with('mpv')

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
    @patch.dict('os.environ', {'LD_LIBRARY_PATH': '/opt/vivaldi/lib', 'LD_PRELOAD': 'libsomething.so', 'PATH': '/usr/bin'})
    def test_launch_mpv_unix_session(self, mock_popen):
        host.launch_mpv('https://youtube.com/watch?v=123', mpv_path='mpv', flags=['--some-flag'])
        mock_popen.assert_called_once()
        kwargs = mock_popen.call_args[1]
        self.assertTrue(kwargs['start_new_session'])
        self.assertNotIn('creationflags', kwargs)
        self.assertIn('env', kwargs)
        self.assertNotIn('LD_LIBRARY_PATH', kwargs['env'])
        self.assertNotIn('LD_PRELOAD', kwargs['env'])
        self.assertEqual(kwargs['env'].get('PATH'), '/usr/bin')


if __name__ == '__main__':
    unittest.main()
