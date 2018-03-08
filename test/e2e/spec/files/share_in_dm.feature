Feature: Sharing files in DM
    Files may be shared by sending in a direct message; sharing a file with a single user
    creates a DM in which the file invitation is sent. There is no way to share a file without
    sending a message.


    Background:
        Given I create my account

    @wip
    @BOT_share_file_in_dm
    Scenario: Share in DM
        Given I upload a 1024 byte file
        When  I share the uploaded file with Cucumbot
        Then  The uploaded file is shared with Cucumbot
        And   Cucumbot received the uploaded file in DM
        And   Cucumbot can download the received file in DM
        When  Cucumbot restarts
        Then  Cucumbot received the uploaded file in DM



