@wip
Feature: File stream and direct messages
    Files may be shared by sending in a direct message; sharing a file with a single user
    creates a DM in which the file invitation is sent. There is no way to share a file without
    sending a message.

    Sending a file in a DM will add the recipient to the permissions matrix for the file with the
    permissions they were granted.

    Background:
        Given I am logged in

    Scenario: Send in DM
        When I send a file to someone
        Then I automatically create a DM
        And I will see they have been invited to be an editor

    Scenario: Send in DM
        When I send a file to someone
        And they accept the invitation
        Then I will see that they have accepted to be an editor

    Scenario: Share the same file twice in the same DM
        Given I upload a file
        Then I will not see it in my file stream
        Then I can share it in a DM
        And the recipient will see an invitation in their file stream
        And I can share it again with the same person
        And they will see the invitation bumped in their file stream


