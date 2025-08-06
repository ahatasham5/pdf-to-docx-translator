
        // Get references to HTML elements
        const pdfFileInput = document.getElementById('pdfFileInput');
        const processButton = document.getElementById('processButton');
        const statusDiv = document.getElementById('status');
        const downloadLink = document.getElementById('downloadLink');

        // Function to update the status message on the page
        function updateStatus(message, type = 'info') {
            statusDiv.textContent = message;
            statusDiv.className = 'status-info'; // Reset class
            if (type === 'error') {
                statusDiv.className = 'status-error';
            } else if (type === 'success') {
                statusDiv.className = 'status-success';
            }
            downloadLink.style.display = 'none'; // Hide download link on new status
            downloadLink.removeAttribute('href');
            downloadLink.removeAttribute('download');
        }

        // Add event listener to the process button
        processButton.addEventListener('click', async () => {
            const file = pdfFileInput.files[0];

            // 1. Validate file selection
            if (!file) {
                updateStatus('Please select a PDF file first.', 'error');
                return;
            }

            if (file.type !== 'application/pdf') {
                updateStatus('Please upload a valid PDF file.', 'error');
                return;
            }

            updateStatus('Processing... Please wait.');
            processButton.disabled = true; // Disable button during processing

            try {
                // --- Step 1: Send PDF to server for DOCX conversion ---
                updateStatus('Converting PDF to DOCX...');
                const formData = new FormData();
                formData.append('pdfFile', file); // 'pdfFile' is the expected field name on the server

                const convertResponse = await fetch('/convert', {
                    method: 'POST',
                    body: formData,
                });

                if (!convertResponse.ok) {
                    const errorText = await convertResponse.text();
                    throw new Error(`PDF conversion failed: ${convertResponse.status} ${convertResponse.statusText} - ${errorText}`);
                }

                const docxBlob = await convertResponse.blob();
                if (docxBlob.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    throw new Error('Server did not return a valid DOCX file from conversion.');
                }

                // --- Step 2: Send DOCX content to server for translation ---
                updateStatus('Translating DOCX content...');
                const translateResponse = await fetch('/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    },
                    body: docxBlob, // Send the DOCX Blob directly
                });

                if (!translateResponse.ok) {
                    const errorText = await translateResponse.text();
                    throw new Error(`DOCX translation failed: ${translateResponse.status} ${translateResponse.statusText} - ${errorText}`);
                }

                const translatedDocxBlob = await translateResponse.blob();
                if (translatedDocxBlob.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    throw new Error('Server did not return a valid DOCX file from translation.');
                }

                // --- Step 3: Enable download of the final, translated DOCX file ---
                const url = URL.createObjectURL(translatedDocxBlob);

                downloadLink.href = url;
                const originalFileName = file.name.split('.').slice(0, -1).join('.');
                downloadLink.download = `${originalFileName}_translated.docx`;
                downloadLink.style.display = 'block'; // Make the download link visible

                updateStatus('Conversion and translation complete! You can now download the file.', 'success');

            } catch (error) {
                console.error('Error during processing:', error);
                updateStatus(`Error: ${error.message}`, 'error');
            } finally {
                processButton.disabled = false; // Re-enable button regardless of success or failure
            }
        });

        // Optional: Clear status and hide download link if a new file is selected
        pdfFileInput.addEventListener('change', () => {
            updateStatus(''); // Clear status message
            downloadLink.style.display = 'none'; // Hide download link
            downloadLink.removeAttribute('href'); // Clear download URL
            downloadLink.removeAttribute('download'); // Clear download filename
        });
    