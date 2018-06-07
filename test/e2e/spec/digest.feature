Feature: Digest

    Testing some tricky aspects of digest.
    Digest is normally tested during any other Cucumbot scenarios,
    but this set of scenarios is supposed to test edge cases.

    @BOT_NO_ACCOUNT_test_multi_client_digest_with_relogin
    Scenario: Digest sync with multiple clients of same user
        Given I create my account
        And   I send my credentials to Cucumbot
        And   Cucumbot logs in
        When  I start a DM with Cucumbot
        And   I send a message "Hi, Cucumbot!"
        Then  Cucumbot receives own message "Hi, Cucumbot!"
        When  Cucumbot sends a message "Hello, stranger."
        Then  I receive own message "Hello, stranger."
        When  I restart without login
        And   Cucumbot sends a message "I see you are offline."
        And   Cucumbot restarts
        And   I login
        And   Cucumbot starts a DM with me
        Then  Cucumbot receives own message "Hi, Cucumbot!"
        And   I receive own message "Hello, stranger."
        And   I receive own message "I see you are offline."

    @BOT_NO_ACCOUNT_test_multi_client_digest_with_offline
    Scenario: Digest sync with multiple clients of same user
        Given I create my account
        And   I send my credentials to Cucumbot
        And   Cucumbot logs in
        When  I start a DM with Cucumbot
        And   I send a message "Hi, Cucumbot!"
        Then  Cucumbot receives own message "Hi, Cucumbot!"
        When  Cucumbot sends a message "Hello, stranger."
        Then  I receive own message "Hello, stranger."
        When  I go offline
        And   Cucumbot sends a message "I see you are offline."
        And   Cucumbot restarts
        And   I go online
        And   Cucumbot starts a DM with me
        Then  Cucumbot receives own message "Hi, Cucumbot!"
        And   I receive own message "Hello, stranger."
        And   I receive own message "I see you are offline."

    @BOT_NO_ACCOUNT_test_multi_client_digest_with_offline2
    Scenario: Digest sync with multiple clients of same user
        Given I create my account
        And   I send my credentials to Cucumbot
        And   Cucumbot logs in
        When  I start a DM with Cucumbot
        And   I wait 5 seconds
        # 2 restars a re needed because lastKnownVersion are not reported for own messages (when chat was created)
        # first restart will call lastKnownVersion, but our test case has to execute without that call in the session
        And   I restart
        And   I wait 3 seconds
        And   I restart
        And   I wait 3 seconds
        And   I go offline
        And   I wait 3 seconds
        And   Cucumbot sends a message "I see you are offline."
        And   I wait 3 seconds
        And   I go online
        Then  I receive own message "I see you are offline."
