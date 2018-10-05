import React from 'react';
import { observer } from 'mobx-react';
import { User } from 'peerio-icebear';
import moment from 'moment';
import { t } from 'peerio-translator';

// TODO/TS: icebear types; refactor to remove `any`

type FileFolderDetailsRowProps =
    | {
          file: any;
      }
    | {
          folder: any;
      };

@observer
export default class FileFolderDetailsRow extends React.Component<
    FileFolderDetailsRowProps
> {
    render() {
        const { props } = this as any;

        const owner = props.file ? props.file.fileOwner : props.folder.owner;

        const timeStamp = moment(
            props.file ? props.file.uploadedAt : props.folder.createdAt
        ).format('ll');

        return (
            <div className="file-folder-details-row">
                <span className="owner">
                    {owner === User.current.username
                        ? `${t('title_you')}`
                        : owner}
                </span>
                <span className="updated-date">{timeStamp}</span>
            </div>
        );
    }
}
