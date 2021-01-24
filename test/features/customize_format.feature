Feature: Customize format

   январь 2020
   пн	вт	ср	чт	пт	сб	вс
            1	2	3	4	5
   6	7	8	9	10	11	12
   13	14	15	16	17	18	19
   20	21	22	23	24	25	26
   27	28	29	30	31

  Background:
    Given Scene is 'customize_scene'

  Scenario: I want select format
    Given now is 2020-01-03 12:00
    When I click inline [Формат]
    Then Bot edits inline buttons:
      """
      [Онлайн]
      [Вне дома]
      [Назад] [События (0)]
      """
    When I click inline [Онлайн]
    Then Bot edits inline buttons:
      """
      [Онлайн ✔]
      [Вне дома]
      [Назад] [События (0)]
      """