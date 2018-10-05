import React from 'react';
import { MaterialIcon } from 'peer-ui';

// TODO: audit still in use?

export default function FileLoading(props: {
    onCancel: () => void;
    loading: string;
}) {
    return (
        <div className="file-loading" onClick={props.onCancel}>
            <MaterialIcon icon={props.loading} />
            <MaterialIcon icon="close" />
        </div>
    );
}
