@wip
Feature: Sharing files in DM
    Files may be shared by sending in a direct message; sharing a file with a single user
    creates a DM in which the file invitation is sent. There is no way to share a file without
    sending a message.


    Background:
        Given I create my account
        And   I upload a 1024 byte file

    @BOT_share_file_in_dm
    Scenario: Share in DM
        When  I share the uploaded file with Cucumbot
        Then  The uploaded file is shared with Cucumbot
        And   Cucumbot can see the uploaded file in DM
        And   Cucumbot can download the received file in DM
        And   Cucumbot can see the uploaded file in his drive
        When  Cucumbot restarts
        Then  Cucumbot can see the uploaded file in DM

    @BOT_unshare_file_in_dm
    Scenario: Unshare in DM
        When  I share the uploaded file with Cucumbot
        Then  The uploaded file is shared with Cucumbot
        And   Cucumbot can see the uploaded file in DM
        And   Cucumbot can see the uploaded file in his drive
        When  I unshare the uploaded file with Cucumbot
        Then  The uploaded file is removed from the DM
        And   Cucumbot has 0 files in his drive
        And   Cucumbot can not see the uploaded file in the room
        And   Cucumbot can not download the uploaded file
        When  Cucumbot restarts
        Then  The uploaded file is removed from the DM
        And   Cucumbot has 0 files in his drive

    @BOT_delete_file_in_dm
    Scenario: Delete file shared in DM
        When  I share the uploaded file with Cucumbot
        Then  The uploaded file is shared with Cucumbot
        And   Cucumbot can see the uploaded file in DM
        And   Cucumbot can see the uploaded file in his drive
        When  I remove the uploaded file
        Then  The uploaded file is removed from the DM
        And   Cucumbot can not see the uploaded file in DM
        And   Cucumbot has 0 files in his drive
        And   Cucumbot can not download the uploaded file
        When  Cucumbot restarts
        Then  The uploaded file is removed from the DM
        And   Cucumbot has 0 files in his drive

    @BOT_share_file_in_room
    Scenario: Share in room
        Given I create a room with Cucumbot
        And   Cucumbot accepts the invite
        When  I share the uploaded file in the room
        Then  The uploaded file is shared in the room
        And   Cucumbot can see the uploaded file in the room
        And   Cucumbot can download the received file in the room
        And   Cucumbot has 0 files in his drive
        When  Cucumbot restarts
        Then  Cucumbot can see the uploaded file in the room
        And   Cucumbot has 0 files in his drive

    @BOT_unshare_file_in_room
    Scenario: Unshare in room
        Given I create a room with Cucumbot
        And   Cucumbot accepts the invite
        When  I share the uploaded file in the room
        Then  The uploaded file is shared in the room
        And   Cucumbot can see the uploaded file in the room
        When  I unshare the uploaded file with the room
        Then  The uploaded file is removed from the room
        And   Cucumbot can not see the uploaded file in the room
        And   Cucumbot can not download the uploaded file
        When  Cucumbot restarts
        And   I restart
        Then  Cucumbot can not see the uploaded file in the room
        And   The uploaded file is removed from the room

    @BOT_delete_file_in_room
    Scenario: Delete file shared in room
        Given I create a room with Cucumbot
        And   Cucumbot accepts the invite
        When  I share the uploaded file in the room
        Then  The uploaded file is shared in the room
        And   Cucumbot can see the uploaded file in the room
        When  I remove the uploaded file
        Then  The uploaded file is removed from the room
        And   Cucumbot can not see the uploaded file in the room
        And   Cucumbot can not download the uploaded file
        When  Cucumbot restarts
        And   I restart
        Then  Cucumbot can not see the uploaded file in the room
        And   The uploaded file is removed from the room

    @BOT_share_file_in_dm_and_room
    Scenario: Share in DM and room
        Given I create a room with Cucumbot
        And   Cucumbot accepts the invite
        When  I share the uploaded file in the room
        And   I share the uploaded file with Cucumbot
        Then  The uploaded file is shared with Cucumbot
        And   The uploaded file is shared in the room
        And   Cucumbot can see the uploaded file in the room
        And   Cucumbot can see the uploaded file in DM
        And   Cucumbot can download the received file in DM
        And   Cucumbot can see the uploaded file in his drive
        When  Cucumbot restarts
        Then  Cucumbot can see the uploaded file in DM

    @BOT_unshare_file_in_dm_and_room
    Scenario: Unshare file shared in DM and room
        Given I create a room with Cucumbot
        And   Cucumbot accepts the invite
        When  I share the uploaded file in the room
        And   I share the uploaded file with Cucumbot
        Then  The uploaded file is shared with Cucumbot
        And   The uploaded file is shared in the room
        And   Cucumbot can see the uploaded file in the room
        And   Cucumbot can see the uploaded file in DM
        And   Cucumbot can see the uploaded file in his drive
        When  I unshare the uploaded file with Cucumbot
        Then  The uploaded file is removed from the DM
        And   Cucumbot can not see the uploaded file in DM
        And   Cucumbot can see the uploaded file in his drive
        And   Cucumbot can see the uploaded file in the room
        When  Cucumbot restarts
        And   Cucumbot can not see the uploaded file in DM
        And   Cucumbot can see the uploaded file in his drive
        And   Cucumbot can see the uploaded file in the room
        When  I unshare the uploaded file with the room
        Then  The uploaded file is removed from the room
        And   Cucumbot can not see the uploaded file in DM
        And   Cucumbot has 0 files in his drive
        And   Cucumbot can not see the uploaded file in the room
        And   Cucumbot can not download the uploaded file
        When  Cucumbot restarts
        And   Cucumbot can not see the uploaded file in DM
        And   Cucumbot has 0 files in his drive
        And   Cucumbot can not see the uploaded file in the room

    @BOT_delete_file_in_dm_and_room
    Scenario: Delete file shared in DM and room
        Given I create a room with Cucumbot
        And   Cucumbot accepts the invite
        When  I share the uploaded file in the room
        And   I share the uploaded file with Cucumbot
        Then  The uploaded file is shared with Cucumbot
        And   The uploaded file is shared in the room
        And   Cucumbot can see the uploaded file in the room
        And   Cucumbot can see the uploaded file in DM
        And   Cucumbot can see the uploaded file in his drive
        When  I remove the uploaded file
        Then  The uploaded file is removed from the DM
        Then  The uploaded file is removed from the room
        And   Cucumbot can not see the uploaded file in DM
        And   Cucumbot can not see the uploaded file in the room
        And   Cucumbot has 0 files in his drive
        And   Cucumbot can not download the uploaded file
        When  Cucumbot restarts
        Then  The uploaded file is removed from the DM
        Then  The uploaded file is removed from the room
        And   Cucumbot can not see the uploaded file in DM
        And   Cucumbot can not see the uploaded file in the room
        And   Cucumbot has 0 files in his drive
        And   Cucumbot can not download the uploaded file

