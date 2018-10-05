/* eslint-disable spaced-comment */
// lint throwing weird `spaced-comment` error on the raw text dump

import React from 'react';
import { observer } from 'mobx-react';
import { observable } from 'mobx';
import * as telemetry from '~/telemetry';

@observer
export default class Terms extends React.Component<{
    onToggleContent?: (content: string) => void;
}> {
    @observable startTime: number;

    componentDidMount() {
        this.startTime = Date.now();
    }

    componentWillUnmount() {
        telemetry.shared.durationTermsDialog(this.startTime);
    }

    openPrivacy = () => {
        telemetry.shared.openPrivacyDialog();
        this.props.onToggleContent('privacy');
    };

    render() {
        return (
            <div className="terms-of-use">
                <h1>Peerio Terms of Use</h1>

                <div className="last-updated">
                    Last updated 18 November 2015
                </div>

                <h3>Preface</h3>
                <p>
                    Much of the information contained in the following Terms of
                    Use involves legal statements we need to make to protect
                    ourselves as a company, and to make it clear to you as a
                    user what legal rights you do and do not have when using the
                    service. If you're looking for Peerio's licensing
                    agreements, service agreements, intellectual property
                    information, etc. You've come to the right place.
                </p>

                <p>
                    If you are primarily interested in what data is available to
                    Peerio and how your data is handled, please view our{' '}
                    <a className="clickable" onClick={this.openPrivacy}>
                        Privacy Policy
                    </a>.
                </p>

                <p>
                    If you are primarily interested in how Peerio responds to
                    law enforcement, please view our&nbsp;
                    <a
                        href="https://github.com/PeerioTechnologies/peerio-documentation/blob/master/Law_Enforcement_Guidelines.md"
                        onClick={telemetry.shared.lawEnforcementLink}
                    >
                        Law Enforcement Guidelines
                    </a>.
                </p>

                <h3>1. Acceptance of Terms</h3>
                <p>
                    Technologies Peerio Inc. ("Peerio" or "we") makes certain
                    websites, applications and service (the “Services”)
                    available to you, subject to these terms of use (the “Terms
                    of Use”). By accessing, browsing and/or using the Services,
                    you acknowledge that you have read, understood and agree to
                    abide by and comply with these Terms of Use, which are
                    intended to be legally binding upon you. We may change the
                    Terms of Use at any time, at our sole discretion, by posting
                    revisions on our website or through any applicable
                    application, and your continued use of the Services
                    indicates your agreement to the modified Terms of Use.
                    Accordingly, we urge you to review the Terms of Use. If you
                    do not agree to the Terms of Use or any revisions thereto,
                    please do not use the Services.
                </p>
                <p>
                    These Terms of Use form a legally binding contract between
                    you and Peerio. If you are an employee of a government,
                    government department or agency (a “Government”), you are
                    agreeing to these Terms of Use on behalf of such Government
                    and represent and warrant to Peerio that you are authorized
                    to enter into contracts on behalf of such Government.
                </p>

                <h3>2. Content</h3>
                <p>
                    All content and materials made available through the
                    Services by Peerio, including but not limited to the text,
                    graphics, user interfaces, computer code and trademarks,
                    names, copyrights and other forms of intellectual property
                    (collectively, the "Content") is owned, controlled, or
                    licensed by or to Peerio and is protected by national and
                    international copyrights, trademarks, service marks,
                    patents, trade secrets, know-how or other proprietary rights
                    and laws. Software that powers the Peerio application is
                    licensed to you subject to the “GNU GENERAL PUBLIC LICENSE
                    Version 3, 29 June 2007”, which is incorporated herein by
                    this reference and which you can view here:
                    https://www.gnu.org/licenses/gpl-3.0.en.html.
                </p>
                <p>
                    Peerio does not own, has no interest in, and cannot access
                    content that is created by its users and transmitted by them
                    through the services. Users are entirely responsible for
                    their own content.
                </p>

                <h3>3. Use of the Services</h3>
                <p>
                    Except as expressly provided in these Terms of Use, no part
                    of the Services and no Content may be reproduced,
                    duplicated, downloaded, sold, resold, published, modified or
                    otherwise distributed for any purpose without the express
                    prior written consent of Peerio.
                </p>
                <p>
                    You may not use any unsanctioned automated or repeated means
                    to obtain access to the Service in a manner that may degrade
                    the Services. You may not use any automatic device, program,
                    algorithm or methodology, or any similar or equivalent
                    manual process, to access, acquire, copy or monitor any
                    portion of the Services or any Content that is not generally
                    available to the public or to registered users of the
                    Services, or in any way obtain or attempt to obtain any
                    materials, documents or information through any means not
                    purposely made available through the Services. Peerio
                    reserves the right to bar any such activity. If you are
                    curious about how the Services work, portions of them are
                    open source and you are invited to review the source code at
                    the Peerio GitHub repository.
                </p>
                <p>
                    You may not attempt to gain unauthorized access to any
                    portion or feature of the Services, or any other systems or
                    networks connected to the Services, or to any of the
                    services offered on or through the Services, by hacking,
                    password "mining" or any other illegitimate means.
                </p>
                <p>
                    Except in strict compliance with the Peerio “Bug Bounty”
                    program, you may not probe, scan or test the vulnerability
                    of the Services or any network connected to the Services,
                    nor breach the security or authentication measures on the
                    Services or any network connected to the Services. You may
                    not reverse look-up, trace or seek to trace any information
                    on any other user of or visitor to the Services, or any
                    other user of Peerio’s products, software or services,
                    including any Peerio account not owned by you, to its
                    source, or exploit the Services or any service or
                    information made available or offered by or through the
                    Services, in any way where the purpose is to reveal any
                    information, including but not limited to personal
                    identification or information, other than your own
                    information, as provided for by the Services.
                </p>
                <p>
                    You agree that you will not take any action that imposes an
                    unreasonable or disproportionately large load on the
                    infrastructure of the Services or Peerio’s systems or
                    networks, or any systems or networks connected to the
                    Services or to Peerio.
                </p>
                <p>
                    You agree not to use any device, software or routine to
                    interfere or attempt to interfere with the proper working of
                    the Services or any transaction being conducted on the
                    Services, or with any other person’s use of the Services.
                </p>
                <p>
                    While we may not need to know who you are, you may not use
                    the Services to impersonate any other individual or entity
                    for the purposes of deceiving any person, including Peerio.
                </p>
                <p>
                    You may not use the Services or any Content for any purpose
                    that is unlawful or prohibited by these Terms of Use, or to
                    solicit the performance of any illegal activity or other
                    activity which infringes the rights of Peerio or others. You
                    may not use the Services for any purpose related to seeking
                    or obtaining any information about any other user of the
                    Services, except with the consent of Peerio and the relevant
                    user(s).
                </p>

                <h3>4. Limited License</h3>
                <p>
                    You are granted a limited, non-exclusive, revocable and
                    non-transferable license to enter and use the Services
                    subject to the restrictions of these Terms of Use. Peerio
                    may change, suspend, or discontinue any aspect of the
                    Services at any time. Peerio may also, without notice or
                    liability, impose limits on certain features and services or
                    restrict your access to all or portions of the Services.
                </p>

                <h3>5. Accounts, Passwords and Security</h3>
                <p>
                    Certain services offered on or through the Services may
                    require you to open an account (including setting up a
                    Peerio account and password). You are entirely responsible
                    for maintaining the confidentiality of the information you
                    hold for your account, including your passphrase, and for
                    any and all activity that occurs under your account as a
                    result of your failing to keep this information secure and
                    confidential. You are responsible for all activities that
                    occur under your password or account. You agree to notify
                    Peerio immediately of any unauthorized use of your account
                    or password, or any other breach of security. You may be
                    held liable for losses incurred by Peerio or any other user
                    of the Services due to someone else using your Peerio
                    username, password or account as a result of your failing to
                    keep your account information secure and confidential.
                </p>
                <p>
                    You may not use anyone else’s Peerio username, password or
                    account at any time without the express permission and
                    consent of the authorized holder of that username, password
                    or account. Peerio cannot and will not be liable for any
                    loss or damage arising from your failure to comply with
                    these obligations.
                </p>

                <h3>6. Violation of the Terms of Use</h3>
                <p>
                    You understand and agree that in Peerio’s sole discretion,
                    and without prior notice, Peerio may block your access to
                    the Services, or exercise any other remedy available, if
                    Peerio believes that your use of the Services has violated
                    or is inconsistent with these Terms of Use, or violates the
                    rights of Peerio, or any third party, or violates any
                    applicable law. You agree that monetary damages may not
                    provide a sufficient remedy to Peerio for violations of
                    these Terms of Use and you consent to injunctive or other
                    equitable relief for such violations.
                </p>
                <p>
                    If Peerio reasonably believes that your activities are (a)
                    unlawful or violate these Terms of Use, and (b) threaten
                    Peerio or its users, Peerio reserves the right to report
                    such activities to relevant law enforcement agencies and to
                    provide information reasonably required to assist in such
                    investigation.
                </p>

                <h3>7. Downloads</h3>
                <p>
                    The Peerio application that is made available to view and/or
                    download in connection with the Services is owned by and is
                    the copyrighted work of Peerio and/or its suppliers and is
                    protected by copyright laws and international treaty
                    provisions. Your use of the Software that powers the Peerio
                    application is licensed to you subject to the “GNU GENERAL
                    PUBLIC LICENSE Version 3, 29 June 2007”, which is
                    incorporated herein by this reference and which you can view
                    here: https://www.gnu.org/licenses/gpl-3.0.en.html. Certain
                    portions of the software may be closed source, in which case
                    you are granted a limited, personal license to use these
                    portions of the Software in the manner intended associated
                    with the use of the Services.
                </p>

                <h3>8. Intensity of Use of the Services</h3>
                <p>
                    You agree that Peerio may establish limits concerning use of
                    any services (including email services) offered through the
                    Services, including without limitation, the maximum number
                    of days that messages will be retained by the service, the
                    maximum number of messages that may be sent from or received
                    by an account on the service, the maximum size of a message
                    that may be sent from or received by an account on the
                    Service, the maximum disk space that will be allotted on
                    Peerio's servers on your behalf, and the maximum number of
                    times and duration you may access the service in a given
                    period of time.
                </p>
                <p>
                    In addition to the terms and conditions set out herein, you
                    agree that you: (a) will comply with all applicable laws
                    with respect to your use of the Services; (b) will not
                    forward or propagate chain letters of any type (including
                    charity requests or petitions for signatures), whether or
                    not the recipient wishes to receive such mailings; (c) will
                    not intentionally flood a user, server, account or site with
                    large or numerous messages; and (d) will not forge header
                    information.
                </p>

                <h3>9. Purchases</h3>
                <p>
                    By making any purchase from Peerio through the Services, you
                    agree to abide and be bound by all applicable contractual
                    terms that are presented to you at the time of the purchase.
                    You further agree that you will not make any purchase from
                    the Services without complying with all applicable laws and
                    regulations, and you warrant that you will not make any
                    purchases through the Services where such purchase is
                    prohibited by local laws. You acknowledge that all purchases
                    made by you through the Services are for your internal or
                    personal use only, and are not for resale or export.
                </p>

                <h3>10. Representations By You</h3>
                <p>
                    By visiting the Services, you represent, warrant and
                    covenant that all materials of any kind submitted by you
                    through the Services or for inclusion on the Services will
                    not violate or infringe upon the rights of any third party
                    including trade secret, copyright, moral right, trademark,
                    trade dress, privacy, patent, or other personal or
                    proprietary rights.
                </p>
                <p>
                    You also represent and warrant that: (i) you will not select
                    or utilize a username of another person with intent to
                    impersonate that person; (ii) you will not select or utilize
                    a username to which another person has rights, if you do not
                    have that person's authorization to use such name; (iii) you
                    will not select or utilize a username for the purposes of
                    deceiving any person regarding your identity, and (iv) you
                    will not select or utilize a username that Peerio in its
                    sole discretion deems offensive.
                </p>
                <p>
                    By visiting the Services, you also represent, warrant and
                    covenant that you are at least of the age of majority in the
                    jurisdiction in which you reside and are capable of entering
                    into legally enforceable contracts.
                </p>

                <h3>11. Our Intellectual Property</h3>
                <p>
                    The Services are owned and operated by Peerio. The Services
                    contain several trademarks, names, copyrights and other
                    forms of intellectual property of great value to Peerio, the
                    ownership and use of which are the exclusive property of
                    Peerio. You acknowledge that all Content is protected by
                    national and international copyrights, trademarks, service
                    marks, patents, trade secrets, know-how or other proprietary
                    rights and laws, all of which are owned by Peerio or our
                    licensors.
                </p>
                <p>
                    Peerio or our licensors retain all rights to the Content
                    found on the Services. Unless otherwise indicated, no one
                    has permission to, in any form, sell, license, rent, modify,
                    distribute, copy, reproduce, transmit, publicly display,
                    publicly perform, publish, adapt, edit or create derivative
                    works from (collectively, "Republish"), any Content except
                    as is incidental to the ordinary use of the Services. Other
                    than source code related to the Services hosted on Github
                    (subject to the terms of the above open source licenses and
                    Github’s terms of use), no material from the Services or any
                    website owned, operated, licensed or controlled by Peerio
                    may be Republished for any purpose without the express prior
                    written consent of Peerio.
                </p>
                <p>
                    Systematic retrieval of data or other content from the
                    Services to create or compile, directly or indirectly, a
                    collection, compilation, database or directory without
                    Peerio’s express written permission is prohibited.
                </p>
                <p>
                    It is forbidden to Republish said Content without the
                    express permission of Peerio, and nothing contained in the
                    Services shall be construed as conferring by implication or
                    otherwise any license or right under any patent, trademark,
                    copyright or other proprietary right. Except as we may
                    expressly authorize, use of the Content is therefore
                    strictly prohibited.
                </p>

                <p>
                    We may, at any time and without notice to you, terminate the
                    privileges of any user who uses the Services to unlawfully
                    transmit copyrighted material without a license, express
                    consent, valid defense, fair dealing exemption or fair use
                    exemption to do so.
                </p>

                <h3>12. Accuracy and Completeness</h3>
                <p>
                    Peerio endeavors to provide current and accurate information
                    and material about the Services, both on its website and
                    through the Services. However, errors, inaccuracies,
                    misprints, omissions or other errors may occur and Peerio
                    reserves the right to make any corrections or changes in its
                    discretion and without prior notice. Peerio does not warrant
                    that the information and material available on the Services
                    is accurate, reliable, complete or current.
                </p>

                <h3>13. Disclaimer</h3>
                <p>
                    **Your use of the services and site material is entirely at
                    your own risk.**
                </p>
                <p>
                    You expressly agree that all materials, information,
                    software, products, services and other content contained on
                    this site are provided "as is" and "as available" for your
                    use. The content is provided without warranties of any kind,
                    either express or implied, including, but not limited to,
                    warranties of title, non-infringement or implied warranties
                    of merchantability, or fitness for a particular purpose, or
                    the warranties stated in the civil code of Québec or
                    otherwise, other than those warranties which are incapable
                    of exclusion, restriction or modification under applicable
                    law. Neither Peerio, nor our licensors, make any warranty
                    that the site will be available at any particular time or
                    location; that the site does not include any defects or
                    errors and that any defects or errors will be corrected;
                    that any files or other data you download from the site will
                    be free of viruses or contamination or destructive features;
                    that any content, service or feature of the site will be
                    error-free or uninterrupted, or that any defects will be
                    corrected, or that your use of the site will provide
                    specific results; or that you will achieve successful
                    results from following any instructions, directions or
                    recommendations on the site.
                </p>

                <h3>14. Limitation of Liability</h3>
                <p>
                    UNDER NO CIRCUMSTANCES SHALL PEERIO, OUR DIRECTORS,
                    SHAREHOLDERS, OFFICERS, EMPLOYEES, AGENTS OR
                    REPRESENTATIVES, OUR LICENSORS, OR ANY OTHER PARTY INVOLVED
                    IN CREATING, PRODUCING OR DELIVERING THIS SITE BE LIABLE FOR
                    ANY DIRECT, INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL OR
                    CONSEQUENTIAL DAMAGES THAT RESULT FROM THE USE OF, OR
                    INABILITY TO USE, THE SITE OR FROM ANY ERRORS OR INFORMATION
                    PROVIDED OR OMITTED ON THE SITE. THIS LIMITATION APPLIES
                    WHETHER THE ALLEGED LIABILITY IS BASED ON CONTRACT, TORT,
                    NEGLIGENCE, STRICT LIABILITY, EXTRA CONTRACTUAL OR ANY OTHER
                    BASIS, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF
                    SUCH DAMAGE. BECAUSE SOME JURISDICTIONS DO NOT ALLOW THE
                    EXCLUSION OR LIMITATION OF INCIDENTAL OR CONSEQUENTIAL
                    DAMAGES, OUR LIABILITY IN SUCH JURISDICTIONS SHALL BE
                    LIMITED TO THE EXTENT PERMITTED BY LAW.
                </p>
                <p>
                    YOU AGREE THAT PEERIO HAS NO RESPONSIBILITY OR LIABILITY FOR
                    THE DELETION, CORRUPTION OR FAILURE TO STORE ANY MESSAGES OR
                    OTHER CONTENT MAINTAINED OR TRANSMITTED BY THE SERVICE. YOU
                    ACKNOWLEDGE THAT PEERIO RESERVES THE RIGHT TO DELETE
                    ACCOUNTS WITHOUT NOTICE TO YOU THAT ARE INACTIVE FOR AN
                    EXTENDED PERIOD OF TIME.
                </p>
                <p>
                    PEERIO ASPIRES TO PRODUCE A SECURE SERVICE, WITH OPEN SOURCE
                    SOFTWARE SO THAT THIRD PARTIES CAN ASSESS ITS SECURITY.
                    WHILE WE ARE TAKING REASONABLE MEASURES TO MAKE THE SERVICES
                    SECURE, NO TOOL CAN MAKE ABSOLUTE SECURITY GUARANTEES AND
                    COMPLICATED SOFTWARE CAN CONTAIN UNKNOWN VULNERABILITIES.
                    THE SERVICES ALSO DEPEND ON THE SECURITY OF UNDERLYING
                    TECHNOLOGIES AND ALGORITHMS, WHICH WE, AS WELL AS
                    INDEPENDENT THIRD PARTIES, BELIEVE ARE ROBUST AND SECURE.
                    BECAUSE OF THIS, PEERIO MAKES NO WARRANTY THAT ANY SERVICE
                    WILL BE AVAILABLE, UNINTERRUPTED, TIMELY, COMPLETELY SECURE
                    OR ERROR-FREE. ANYONE USING THE SERVICES IS REQUIRED TO
                    ASSESS THE SERVICES IN LIGHT OF THEIR OWN SECURITY AND
                    RELIABILITY NEEDS AND CONDUCT THEMSELVES ACCORDINGLY.
                </p>

                <h3>15. Indemnification</h3>
                <p>
                    You agree to defend, indemnify, and hold Peerio and our
                    employees, agents, representatives, officers and directors
                    harmless from all liabilities, claims and expenses,
                    including attorney's fees that arise from your use or misuse
                    of the Services or Content. We reserve the right, at our own
                    expense, to assume the exclusive defense and control of any
                    matter otherwise subject to indemnification by you, in which
                    event you will cooperate with us in asserting any available
                    defenses.
                </p>

                <h3>16. Links to Other Websites</h3>
                <p>
                    Peerio is only responsible for information, sites and
                    services under its direct control. Even if we link to or
                    refer you to another provider’s content or services, you are
                    entirely responsible for determining whether content or
                    service is appropriate for you. Peerio does not guarantee,
                    represent or warrant that the content contained in any third
                    party sites is accurate, legal and/or inoffensive. Peerio
                    does not endorse the content of any third party site, nor
                    does it make any representation or warranty about these
                    sites, including that they will not contain viruses or
                    otherwise impact your computer.
                </p>

                <h3>17. Confidential or Exclusive Information</h3>
                <p>
                    Peerio runs on open source software and we invite users and
                    others to contribute to its development. By contributing
                    ideas, software code and concepts to Peerio, you grant to
                    Peerio the unlimited right to use such ideas, software code
                    and concepts or any purpose whatsoever without any
                    obligation or compensation to you. You also specifically
                    waive any intellectual property rights in favour of Peerio,
                    including moral rights. The rights granted to Peerio under
                    this paragraph may be assigned by Peerio in connection with
                    any sale of all or substantially all of the business
                    associated with the Services.
                </p>

                <h3>18. Governing Law</h3>
                <p>
                    This agreement shall be governed by and construed in
                    accordance with the laws of the province of Québec, Canada
                    without giving effect to any principles of conflicts of law.
                    You expressly agree that the exclusive jurisdiction for any
                    claim or action arising out of or relating to these Terms of
                    Use or your use of the Services shall be filed only in the
                    provincial or federal courts located in the province of
                    Québec, and you further agree and submit to the exercise of
                    personal jurisdiction of such courts for the purpose of
                    litigating any such claim or action.
                </p>
                <p>
                    By choosing to access the Services from any location other
                    than Canada, you accept full responsibility for compliance
                    with all local laws that are applicable. Peerio makes no
                    representation that the information and material on the
                    Services is appropriate or available for use in locations
                    outside Canada, and accessing it from territories where
                    their contents is illegal is prohibited. You may not use any
                    information or material from the Services in violation of
                    any applicable laws or regulations.
                </p>

                <h3>19. Privacy Policy</h3>
                <p>
                    By using the Services, you also agree to be bound by
                    Peerio's{' '}
                    <a className="clickable" onClick={this.openPrivacy}>
                        Privacy Policy
                    </a>.
                </p>

                <h3>20. Miscellaneous</h3>
                <p>
                    If any provision of these Terms of Use should prove to be
                    unlawful, void, or for any reason unenforceable, that
                    provision shall be deemed severable from this agreement and
                    shall not affect the validity and enforceability of any
                    remaining provisions. Peerio's failure to insist upon or
                    enforce strict performance of any provision of these Terms
                    of Use shall not be construed as a waiver of any right on
                    its part. These Terms of Use constitute the entire agreement
                    between the parties relating to the subject matter herein,
                    supersede all prior or contemporaneous communications and
                    proposals between you and Peerio with respect to the
                    Services, and shall not be modified except in writing.
                    Section titles in the Terms of Use are for convenience and
                    do not define, limit, or extend any provision of the Terms
                    of Use.
                </p>
            </div>
        );
    }
}
