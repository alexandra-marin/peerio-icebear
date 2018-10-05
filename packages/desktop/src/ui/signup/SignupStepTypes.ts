export interface SignupStep {
    store: any;
    onComplete: () => void;
}

export interface StepContentObject {
    left: React.ReactFragment;
    right: React.ReactFragment;
}
