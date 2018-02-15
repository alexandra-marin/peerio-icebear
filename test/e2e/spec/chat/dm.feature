Feature: Direct Messages

    DM-specific cases go here.
    Most of the chat-related scenarios are in the room features.

    # Cucumbot is a keyword, main test process will skip the steps starting with the keyword
    # the test bot process will only run steps starting with Cucumbot keyword

    @wip
    @BOT_create_and_use_a_dm_chat
    Scenario: Create and use a DM chat
        Given I create my account
        When  I start a DM with Cucumbot
        And   I send a message "Hi, Cucumbot!"
        Then  Cucumbot receives a message "Hi, Cucumbot!"
        When  Cucumbot sends a message "Hello, stranger."
        Then  I receive a message "Hello, stranger."
        When  I restart
        And   Cucumbot restarts
        And   Cucumbot starts a DM with me
        Then  Cucumbot receives a message "Hi, Cucumbot!"
        Then  I receive a message "Hello, stranger."
