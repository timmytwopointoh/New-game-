# Realm AI Live v0.21 source candidate

This update keeps the Microsoft one-time code copy action and mounts it visibly on
the home screen while a device-code challenge is pending. The official
`https://www.microsoft.com/link` URL is now a clickable link both in the status
area and the sign-in dialog. If no code is pending, Settings explains that there
is nothing to copy; the app does not clear saved authentication or force a new
sign-in.

Settings also has the optional one-file share action. Android asks the user to
choose a file and then a recipient. The app requests only a temporary read grant
for that selected file, requests no broad storage permission, and does not retain
file access.

The Android package remains `com.veilforge.realmagent.live` and candidate version
code is 200002. Updates must use the matching permanent signing certificate
`F268E5085B79197ECA9CA9EA1F94BC625D045F191E5E4704A22178D47696DA06`. The B5D
certificate used by the separate `com.veilforge.realmagent` app cannot update this
package. No replacement key is generated.

Verification: 13 Android button-action tests passed, including code copy, exact
Microsoft URL opening, selected-file sharing, cancellation and read-only URI grants.
The compact phone layout test passed at 360×640 and 360×440. No APK was signed or
published because the matching private signing key is not available in this session.
