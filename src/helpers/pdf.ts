import pdfform from 'pdfform.js';
import { FileStream, assetPathResolver } from '../config';

/**
 * Generates and saves a pdf file with account recovery information
 * @param destination file path
 * @param username
 */
export default async function saveAccountKeyBackup(
    destination: string,
    displayName: string,
    username: string,
    accountKey: string
) {
    // getting template file as a buffer to later process it and perform substitutions
    const templatePath = assetPathResolver('account_key_backup.pdf');
    const templateStream = new FileStream(templatePath, 'read');
    await templateStream.open();
    const { size } = await FileStream.getStat(templatePath);
    const template = await templateStream.read(size);
    templateStream.close();
    // performing substitution (filling pdf form fields)
    const fields = {
        displayName: [displayName],
        username: [username],
        accountKey: [accountKey],
        date: [new Date().toLocaleDateString()]
    };
    const outBuffer = pdfform().transform(template.buffer, fields);

    // writing out destination file
    const outStream = new FileStream(destination, 'write');
    await outStream.open();
    await outStream.write(outBuffer);
    await outStream.close();
}
