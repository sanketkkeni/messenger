# Build Lambda zip files for deployment
# Run from the backend directory: ./build.ps1

Write-Host "Building Lambda zip files..."

# Create utils.zip
Compress-Archive -Path utils.py -DestinationPath utils.zip -Force
Write-Host "Created utils.zip"

# Create authorizer.zip
Compress-Archive -Path authorizer.py,utils.py -DestinationPath authorizer.zip -Force
Write-Host "Created authorizer.zip"

# Create connect_handler.zip
Compress-Archive -Path connect_handler.py,utils.py -DestinationPath connect_handler.zip -Force
Write-Host "Created connect_handler.zip"

# Create disconnect_handler.zip
Compress-Archive -Path disconnect_handler.py,utils.py -DestinationPath disconnect_handler.zip -Force
Write-Host "Created disconnect_handler.zip"

# Create message_handler.zip
Compress-Archive -Path message_handler.py,utils.py -DestinationPath message_handler.zip -Force
Write-Host "Created message_handler.zip"

# Create users_handler.zip
Compress-Archive -Path users_handler.py,utils.py -DestinationPath users_handler.zip -Force
Write-Host "Created users_handler.zip"

Write-Host "Build complete!"