import React from 'react';
import { observer } from 'mobx-react';
import T from '~/ui/shared-components/T';
import { zeroFilesIllustrationUrl } from '~/whitelabel/components/ZeroFiles';

interface ZeroFilesProps {
    isRoot?: boolean;
}

@observer
export default class ZeroFiles extends React.Component<ZeroFilesProps> {
    render() {
        return (
            <div className="zero-files">
                {this.props.isRoot ? (
                    <React.Fragment>
                        <T k="title_zeroFiles" className="headline" />
                        <T k="title_zeroFilesSubtitle" />
                    </React.Fragment>
                ) : (
                    <T k="title_emptyFolder" className="headline" />
                )}

                <img src={zeroFilesIllustrationUrl} className="illustration" />
                <div className="instructions">
                    <T k="title_zeroFilesDescription" className="instructions">
                        {{
                            uploadMockButton: text => (
                                <span className="mock-button">{text}</span>
                            )
                        }}
                    </T>
                </div>
            </div>
        );
    }
}
