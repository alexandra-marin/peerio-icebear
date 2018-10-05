import React from 'react';
import { observer } from 'mobx-react';
import { observable } from 'mobx';
import * as telemetry from '~/telemetry';

@observer
export default class Privacy extends React.Component<{
    onToggleContent?: (content: string) => void;
}> {
    @observable startTime: number;

    componentDidMount() {
        this.startTime = Date.now();
    }

    componentWillUnmount() {
        telemetry.shared.durationPrivacyDialog(this.startTime);
    }

    openTerms = () => {
        telemetry.shared.openTermsDialog();
        this.props.onToggleContent('terms');
    };

    render() {
        return (
            <div className="privacy-policy">
                <h1>Privacy Policy</h1>

                <p>
                    <em>Last updated 3 August 2018</em>
                </p>

                <p>
                    This privacy policy (“Policy”) governs how Technologies
                    Peerio Inc. (“Peerio”, “we,” “us,” “our,” etc.) handles and
                    processes users (“you,” “your,” etc.) data in the Peerio
                    application and on our website and servers (collectively,
                    the “Services”).
                </p>

                <p>
                    This policy is subject to our{' '}
                    <a className="clickable" onClick={this.openTerms}>
                        Terms of Use
                    </a>{' '}
                    as well as any other agreements or notices that may be
                    associated with a particular Peerio product, service, or
                    website (“Peerio offering”) and may provide additional
                    information about how Peerio handles your data. Your use of
                    Peerio services or offerings indicates your consent to this
                    Privacy Policy and our Terms of Use. You may not use Peerio
                    if you do not agree to the terms described in this policy.
                </p>

                <p>
                    Peerio aims to provide ambitious security assurances. As a
                    result, we want to be as open and transparent as possible
                    about our technology and how your data is handled when using
                    Peerio Services. The Peerio app is open source and our
                    client source code is publicly available for review on{' '}
                    <a href="https://github.com/PeerioTechnologies">GitHub</a>.
                </p>

                <p>
                    Philosophically, Peerio endeavors to collect, use and
                    disclose the minimum amount of personal information that is
                    necessary to operate the Services.
                </p>

                <p>
                    If you have any other questions, please contact us at
                    peerio@peerio.com.
                </p>

                <h3 id="1-what-the-peerio-app-can-do-to-protect-your-privacy">
                    1. What the Peerio app can do to protect your privacy
                </h3>

                <p>
                    Peerio provides message sharing, file sharing, and cloud
                    storage with end-to-end encryption that makes your data
                    inaccessible to anyone other than you and your intended
                    recipient(s), even Peerio cannot access the contents of your
                    messages and files. The confidentiality, integrity and
                    authenticity of the ciphertext (your encrypted data) is
                    designed to be protected by Peerio against:
                </p>

                <ul>
                    <li>
                        <strong>Server compromise</strong> — If Peerio’s server
                        network is ever compromised, the content of your
                        messages and files will remain inaccessible to any third
                        party, including Peerio and its employees.
                    </li>
                    <li>
                        <strong>Malicious Host</strong> — The Peerio app
                        protects against message forgery, file modification, and
                        artificial read receipts of messages that have not been
                        read.
                    </li>
                    <li>
                        <strong>Man-in-the-middle attacks</strong> — The Peerio
                        app provides means for users to securely authenticate
                        each other’s cryptographic identities (see{' '}
                        <a href="https://peerio.zendesk.com/hc/en-us/articles/204394135">
                            “Peerio ID#”
                        </a>).
                    </li>
                    <li>
                        <strong>Unauthorized account access</strong> — Peerio
                        protects a user’s account and identity by using
                        authentication challenges, a randomly generated Account
                        Key and optional{' '}
                        <a href="https://peerio.zendesk.com/hc/en-us/articles/203665635">
                            two-factor authentication (2FA)
                        </a>.
                    </li>
                </ul>

                <h3 id="2-what-the-peerio-app-does-not-do">
                    2. What the Peerio app does not do
                </h3>

                <p>
                    Peerio does not anonymize connections, geolocation, or the
                    identity of users. Peerio is compatible with certain
                    anonymizing software, however we cannot recommend or
                    guarantee any claims such tools may make. We can only
                    provide assurances about the things we control.
                </p>

                <p>
                    Peerio cannot protect against key-loggers or other similar
                    malware and backdoors that may exist on a user’s machine. It
                    is the user’s responsibility to ensure their device is free
                    of such software.
                </p>

                <p>
                    Peerio cannot protect you from Account Key mismanagement,
                    such as telling others your Account Key or storing your
                    Account Key in an insecure location.
                </p>

                <p>
                    Peerio cannot protect you from environmental concerns, such
                    as leaving your device unattended with Peerio open or people
                    looking over your shoulder.
                </p>

                <h3 id="3-how-peerio-protects-your-privacy">
                    3. How Peerio protects your privacy
                </h3>

                <h4 id="technology">Technology</h4>

                <p>
                    Peerio uses state-of-the-art encryption to offer high
                    security standards in an intuitive, easy-to-use application.
                </p>

                <p>
                    Peerio relies on the following cryptographic primitives, or
                    “building blocks”:
                </p>

                <ul>
                    <li>
                        <strong>Curve25519</strong> — is used to provide public
                        key agreement over elliptic curves.
                    </li>
                    <li>
                        <strong>XSalsa20</strong> — is used in order to provide
                        encryption and confidentiality.
                    </li>
                    <li>
                        <strong>Poly1305</strong> — is used in order to ensure
                        the integrity of encrypted data.
                    </li>
                    <li>
                        <strong>Scrypt</strong> — is used in order to provide
                        memory-hard key derivation.
                    </li>
                    <li>
                        <strong>BLAKE2</strong> — is used for various operations
                        requiring hash function operations.
                    </li>
                </ul>

                <p>
                    For in-transit encryption, Peerio Services use Transport
                    Layer Security (TLS) with best-practice cipher suite
                    configuration, including support for perfect forward secrecy
                    (PFS). You can view a detailed and up-to-date independent
                    review of Peerio’s TLS configuration on{' '}
                    <a href="https://www.ssllabs.com/ssltest/analyze.html?d=icebear.peerio.com&amp;latest">
                        SSL Labs
                    </a>.
                </p>

                <p>
                    The Peerio network manages public key exchange and
                    verification, while also offering users independent
                    out-of-band public key authentication. When you sign up for
                    Peerio, you are assigned a randomly generated Account Key.
                    This is then used to derive your unique private encryption
                    key. Your Account Key, along with your username, is used to
                    derive the Peerio ID# assigned to your account. You can
                    independently verify a user’s cryptographic identity via
                    their Peerio ID#.
                </p>

                <h4 id="accountability">Accountability</h4>

                <h5 id="open-source">Open source</h5>

                <p>
                    Peerio’s client code is open source to provide transparency
                    and strengthen Peerio’s security through ongoing public
                    review, testing, and evaluation. Peerio’s client code is
                    available for review on{' '}
                    <a href="https://github.com/PeerioTechnologies">GitHub</a>.
                </p>

                <h5 id="bug-bounty">Bug bounty</h5>

                <p>
                    To encourage community peer review and security research,
                    Peerio offers a{' '}
                    <a href="https://peerio.zendesk.com/hc/en-us/articles/203981385">
                        Bug Bounty
                    </a>{' '}
                    of up to $5000 for anyone able to successfully identify a
                    critical security vulnerability in Peerio.
                </p>

                <p>
                    Peerio’s bug bounty operates with a policy of responsible
                    disclosure. Bug reports must not publicly disclose a
                    security vulnerability before allowing Peerio a reasonable
                    amount of time to address the issue. This policy also holds
                    us responsible for swiftly fixing ‘high’ or ‘critical’
                    vulnerabilities that affect user security, and disclosing
                    reported bugs and fixes within a reasonable amount of time.
                </p>

                <h5 id="security-audits">Security audits</h5>

                <p>
                    To ensure Peerio’s security in its most recent iteration
                    keeps pace with contemporary technological standards,
                    Peerio’s client and server code undergo independent
                    third-party security audits.
                </p>

                <p>
                    Peerio was last audited March 2017 by expert cryptographers
                    and penetration testers at{' '}
                    <a href="https://cure53.de/">Cure53</a>.
                </p>

                <h5 id="organizational-structure">Organizational structure</h5>

                <p>
                    All our employees undergo security training for in-office
                    procedures, online practices, and responding to attempts to
                    obtain data through phishing or other forms of social
                    engineering.
                </p>

                <p>
                    Access to information and operational structures, including
                    user data, servers, and support services, is regulated to as
                    few employees as is necessary to provide you with Peerio
                    services.
                </p>

                <h3 id="4-what-information-peerio-has-access-to-and-how-it-may-be-used">
                    4. What information Peerio has access to and how it may be
                    used
                </h3>

                <p>
                    We retain only basic information needed to provide Peerio
                    services to users and to improve Peerio’s operations. More
                    information about this is provided below.
                </p>

                <h4 id="user-provided-information">
                    User-provided information
                </h4>

                <p>
                    When you sign up for the Peerio App, we collect the
                    information you provided to open your account, including
                    your username, first and last name (legal name not
                    required), and contact information such as email addresses
                    or phone numbers (optional). This information is used to
                    help you connect with your contacts on Peerio, send you
                    important updates about your account, and to offer support
                    with account services.
                </p>

                <p>
                    When you invite your contacts to join Peerio with the “Add
                    Contacts” or “Import Contacts” feature, you provide us with
                    the email addresses and/or phone numbers of your contacts.
                    This information will be used only to send the invitation
                    you have requested via email or SMS or to notify you when
                    one of your contacts joins Peerio. We will not use this
                    information for any other purpose.
                </p>

                <p>
                    When you send messages to our support team, your email will
                    be filed for follow-up correspondence, and any information
                    you directly provide in your support request will be used to
                    assist you in your support request. Please do not send any
                    sensitive information through our support center, such as
                    your Peerio Account Key, credit card, or other payment
                    information.
                </p>

                <h4 id="ciphertext">Ciphertext</h4>

                <p>
                    Peerio has access to the ciphertext (encrypted data) of
                    messages and files you share or upload. The contents of this
                    encrypted data can only be read by a user and their intended
                    recipients, and cannot be read by Peerio or any other third
                    parties. Peerio has access to ciphertext only for the
                    purposes of delivering, receiving, and/or storing users’
                    encrypted messages and files. We cannot decrypt this
                    ciphertext and we (and teams of independent auditors)
                    believe that it is resistant to highly sophisticated
                    attacks.
                </p>

                <h4 id="metadata">Metadata</h4>

                <p>
                    Some metadata of Peerio messages is accessible by Peerio’s
                    servers and needed in order to provide services. This
                    includes, the sender’s and recipient(s)’ usernames and
                    Peerio ID#s; the time at which messages and files are sent
                    and received; the size of files uploaded to Peerio; the
                    message ID that a file is attached to; and a user’s Peerio
                    contacts’ usernames and Peerio ID#s.
                </p>

                <h4 id="account-information">Account information</h4>

                <p>
                    Peerio has access to your Peerio account settings and
                    information, such as language preferences, notification
                    settings, storage usage information, logs of authentication
                    errors, timestamps of server requests, and users’ sent,
                    received, and rejected contact requests.
                </p>

                <h4 id="ip-addresses">IP Addresses</h4>

                <p>
                    The Peerio App and website are able to identify a user’s IP
                    address, which can be used to determine user connections,
                    geolocation, and identities.
                </p>

                <p>
                    Peerio collects IP address information to connect to our
                    data centers, as well as help users review connection
                    attempts, and identify any possible suspicious activity with
                    their account in order to protect Peerio and its users.
                </p>

                <p>
                    IP address information may also be used to protect users’
                    ability to connect to Peerio network by identifying and
                    preventing attacks on the Peerio server network.
                </p>

                <h4 id="crash-reports">Crash Reports</h4>

                <p>
                    Peerio clients for mobile devices offer optional crash and
                    exception reports. You have the choice of whether to submit
                    such a report to Peerio, and reporting is disabled by
                    default. These reports are completely anonymous and are used
                    to help Peerio improve services and support for Peerio’s
                    mobile and desktop clients. Crash and exception reports will
                    include the device platform, device type, device model,
                    operating system version, Peerio client version, stack
                    track, and the exception name and type.
                </p>

                <h4 id="opt-in-analytics">Opt-in Analytics</h4>

                <p>
                    Users are able to opt-in for anonymous non-content data
                    collection that aids Peerio’s ongoing usability research and
                    design work. This option is off by default and can be
                    enabled or disabled by the user at any time through their
                    account settings. If enabled, the user agrees to allow the
                    Peerio client to collect non-identifying and non-content
                    data; such as the amount of time spent on a given page or
                    between actions, or which actions are taken or not taken on
                    a page.
                </p>

                <h3 id="5-what-information-peerio-shares-with-third-parties">
                    5. What information Peerio shares with third parties
                </h3>

                <p>
                    We do not sell, trade, or rent any user information to any
                    third parties. There are limited situations in which Peerio
                    will share user data in order to provide our services. These
                    include:
                </p>

                <h4 id="peerio-support-services">Peerio support services</h4>

                <p>
                    When you make an emailed request to Peerio support, your
                    email as well as the content of your request will be
                    available to our support services provider.
                </p>

                <h4 id="email-and-sms-notifications-and-invitations">
                    Email and SMS notifications and invitations
                </h4>

                <p>
                    Your email and/or phone number will be shared with the
                    message service we use to deliver such notifications. Such
                    messages cannot be delivered without communicating such
                    information to the message services provider. Notifications
                    are used to deliver Peerio confirmation codes, invitations
                    to contacts, and (optionally) notices about the number of
                    new messages or contact requests you may have. No Peerio
                    message or file content is ever shared. This information
                    will not be used for any purpose other than message
                    delivery.
                </p>

                <p>
                    When you send an invitation to one of your contacts, the
                    message will include the name you have registered with
                    Peerio as well as your Peerio username. This is to inform
                    your contacts of who is inviting them and how to connect
                    with you on Peerio. You control what information you provide
                    to Peerio for such purposes.
                </p>

                <h4 id="payments">Payments</h4>

                <p>
                    All payments made to Peerio, along with payment information
                    (date, amount, sender, recipient, etc) are shared with and
                    processed through a third party payment service. Peerio does
                    not host any payment information.
                </p>

                <h4 id="opt-in-analytics-1">Opt-in Analytics</h4>

                <p>
                    If opted-in to share anonymized usage data, Peerio may
                    choose to share this non-content and non-identifying data
                    with third parties in order to improve Peerio’s user
                    experience, or with researchers in the pursuit of improving
                    public knowledge on issues related to security and design.
                </p>

                <h3 id="6-account-removal">6. Account Removal</h3>

                <p>
                    You may delete your Peerio account at any time, for any
                    reason. However, to prevent third-party requests to delete
                    user data, Peerio cannot delete your account for you.
                </p>

                <p>
                    Deleting your account will disassociate any contact
                    information, such as email addresses or phone numbers
                    registered to that account.
                </p>

                <p>
                    Any data that is owned only by you and has not been shared
                    with other users will be removed completely from Peerio’s
                    servers and network.
                </p>

                <p>
                    Data that has not been destroyed and has been shared with
                    other users will remain on the Peerio network until all
                    users with whom it has been shared have destroyed the data
                    in question.
                </p>

                <h3 id="7-data-retention-and-removal">
                    7. Data Retention and Removal
                </h3>

                <p>
                    Peerio retains user data only as long is necessary to
                    provide Peerio’s services to users. While your account is
                    registered and in use, this includes the data Peerio has
                    access to, as outlined above. Activity logs are securely
                    wiped after 30 days.
                </p>

                <p>
                    If you delete a message or a file that you have previously
                    shared, it will not be removed from our servers until all
                    recipients have also removed it from their account(s), at
                    which point the message or file and its metadata will be
                    securely wiped within 24 hours. If you delete a message or
                    file that you have not shared with anyone, that data and
                    associated metadata will be securely wiped from Peerio’s
                    servers within 24 hours.
                </p>

                <p>
                    If you delete and unshare a file, it will be removed from
                    Peerio’s servers, network, and all users immediately.
                    However, we cannot destroy evidence that a file with a
                    particular encrypted file ID was once sent in a message. The
                    message it was sent in will have a trace of this ID, as it
                    is in the encrypted body of the message. Because it is
                    encrypted, we are unable to remove it from such messages.
                    This allows the Peerio app to verify that files the server
                    has sent with a message were put there by the designated
                    sender, and not a third party. Peerio cannot read the
                    plaintext name of the file.
                </p>

                <p>
                    Upon account deletion, Peerio removes all your data from our
                    servers and network, except for your account username, your
                    Peerio Public Key, any messages and files you have shared
                    with other users that you have not destroyed, and any data
                    required to maintain the functionality and operability of
                    Peerio for existing users. This information is necessary for
                    your former contacts to be able to identify and decrypt
                    messages they have received from you and continue utilizing
                    the application as intended. This information also helps us
                    prevent attempts to create fraudulent accounts representing
                    a previous user.
                </p>

                <p>
                    The Peerio Service runs on servers operated by our
                    contractors and those servers may be located outside of
                    Canada.
                </p>

                <p>
                    Information related to users you have invited to join
                    Peerio, but who have not subsequently created an account
                    with Peerio, will be retained while your account remains
                    active. This information is solely used to help deliver
                    contact requests, referral rewards to you and your contacts,
                    and to provide you with notifications when one of your
                    contacts joins Peerio. This information will never be used
                    for any other purpose.
                </p>

                <h3 id="8-law-enforcement-policies">
                    8. Law Enforcement Policies
                </h3>

                <p>
                    We recognize that law enforcement agencies may make
                    legitimate requests for user data from Peerio. Peerio is
                    located in Quebec, Canada and all of our information systems
                    are managed from Canada. We are of the view that we can only
                    be compelled to provide information to third parties
                    according to the federal laws of Canada and the provincial
                    laws in Quebec. We are also of the view that we can only be
                    compelled to provide the limited user information we have
                    according to the federal laws of Canada and the provincial
                    laws in Quebec. We will only provide user information to a
                    third party where we are of the view that we are compelled
                    to do so by applicable legal process.
                </p>

                <p>
                    Law enforcement agencies outside of Canada should use
                    letters rogatory or procedures established under any
                    applicable Mutual Legal Assistance treaty.
                </p>

                <p>
                    Users will be notified if a request has been made to provide
                    their data to a law enforcement agency, unless Peerio is
                    legally unable to do so.
                </p>

                <p>
                    Any law enforcement request can only retrieve, as a maximum,
                    information available to Peerio. As Peerio does not handle
                    users private encryption keys, Peerio cannot provide law
                    enforcement agencies with plaintext or unencrypted messages
                    or files a user may have uploaded, downloaded, sent, or
                    received in Peerio. However, certain metadata may be subject
                    to seizure – see above, “What Information Peerio Has Access
                    to”.
                </p>

                <p>
                    Please view our{' '}
                    <a href="https://github.com/PeerioTechnologies/peerio-documentation/blob/master/Law_Enforcement_Guidelines.md">
                        Law Enforcement Guidelines
                    </a>{' '}
                    for full details.
                </p>

                <h3 id="9-peerio-s-use-by-children-or-minors">
                    9. Peerio’s Use by Children or Minors
                </h3>

                <p>
                    Peerio does not have access to any information that would
                    identify a user’s age, nor do we retain any information that
                    might be able to do so. However, Peerio is not intended to
                    be used by children or persons who are not capable of
                    entering into a legally binding contract between themselves
                    and Peerio. Any person who is under the age of majority in
                    the jurisdiction in which they reside must obtain the
                    consent of their legal guardian to create a Peerio account
                    and to consent on their behalf to this Policy.
                </p>

                <h3 id="10-privacy-policy-is-subject-to-change">
                    10. Privacy Policy is Subject to Change
                </h3>

                <p>
                    This privacy policy may be updated at any time, and for any
                    reason. We will post updates to the policy here and notify
                    users of updates through other publicly-available
                    communication channels. We will always note where changes
                    are made, as well as provide a history of previous versions
                    of our privacy policy.
                </p>

                <h3 id="11-contact-us">11. Contact Us</h3>

                <p>
                    We have done our best to thoroughly outline the ways in
                    which Peerio handles your data within this privacy policy.
                    If you have any questions or complaints about Peerio’s
                    handling of your personal information or if you want access
                    to your personal information in the custody or control of
                    Peerio, please contact us at peerio@peerio.com
                </p>
            </div>
        );
    }
}
