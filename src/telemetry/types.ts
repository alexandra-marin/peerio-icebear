export interface EventProperties {
    [key: string]: string | number | boolean;
}

export interface EventObject {
    event: string;
    properties: EventProperties;
}
